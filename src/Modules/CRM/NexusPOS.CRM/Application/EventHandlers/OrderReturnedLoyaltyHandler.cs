using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.CRM.Application.Services;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.ValueObjects;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.POS.Domain.Events;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.CRM.Application.EventHandlers;

// On a refund of a customer's sale: take back the points it earned in proportion to the goods returned (never below
// zero) and give back redeemed points the refund did not already pay out in cash. The sale's own ledger rows say what
// it earned and spent; sales from before the ledger fall back to the current programme. Failures never undo the refund.
internal sealed class OrderReturnedLoyaltyHandler(CrmDbContext db, ILogger<OrderReturnedLoyaltyHandler> logger)
    : INotificationHandler<ReturnOrderCompletedDomainEvent>
{
    public async Task Handle(ReturnOrderCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        if (notification.Loyalty is not { } loyalty)
        {
            return;
        }

        try
        {
            CustomerId id = new(loyalty.CustomerId);
            Customer? customer = await db.Customers
                .FirstOrDefaultAsync(c => c.TenantId == notification.TenantId && c.Id == id, cancellationToken);
            if (customer is null)
            {
                logger.LogWarning("Return {ReturnId} references unknown customer {CustomerId}", notification.ReturnOrderId, loyalty.CustomerId);
                return;
            }

            List<LoyaltyTransaction> history = await db.LoyaltyTransactions
                .Where(t => t.TenantId == notification.TenantId && t.OrderId == notification.OriginalOrderId)
                .ToListAsync(cancellationToken);

            int earned;
            int redeemed;
            if (await IsFromBeforeLedgerAsync(history, notification.TenantId, loyalty.OrderCompletedAt, cancellationToken))
            {
                LoyaltyRules rules = await CustomerLoyaltyDirectory.LoadRulesAsync(db, notification.TenantId, cancellationToken);
                earned = rules.PointsEarned(loyalty.OrderTotal);
                redeemed = loyalty.PointsRedeemed;
            }
            else
            {
                earned = history.Where(t => t.Kind == LoyaltyTransactionKind.Earn).Sum(t => t.Delta);
                redeemed = -history.Where(t => t.Kind == LoyaltyTransactionKind.Redeem).Sum(t => t.Delta);
            }

            LoyaltyReversal.Result reversal = LoyaltyReversal.Compute(
                earned,
                redeemed,
                loyalty.OrderTotal,
                loyalty.PointsValue,
                loyalty.ReturnedShare,
                loyalty.RefundedToDate,
                alreadyTakenBack: -history.Where(t => t.Kind == LoyaltyTransactionKind.Reverse && t.Delta < 0).Sum(t => t.Delta),
                alreadyGivenBack: history.Where(t => t.Kind == LoyaltyTransactionKind.Reverse && t.Delta > 0).Sum(t => t.Delta));

            string reason = $"Return {notification.ReturnOrderId}";
            if (reversal.TakeBack > 0)
            {
                int taken = customer.TakeBackLoyaltyPoints(reversal.TakeBack);
                if (taken < reversal.TakeBack)
                {
                    logger.LogWarning(
                        "Return {ReturnId} should take back {Points} points but customer {CustomerId} only had {Taken}",
                        notification.ReturnOrderId, reversal.TakeBack, loyalty.CustomerId, taken);
                }

                if (taken > 0)
                {
                    db.LoyaltyTransactions.Add(LoyaltyTransaction.Create(
                        notification.TenantId, loyalty.CustomerId, -taken, LoyaltyTransactionKind.Reverse,
                        notification.OriginalOrderId, reason: reason));
                }
            }

            if (reversal.GiveBack > 0)
            {
                customer.AddLoyaltyPoints(reversal.GiveBack);
                db.LoyaltyTransactions.Add(LoyaltyTransaction.Create(
                    notification.TenantId, loyalty.CustomerId, reversal.GiveBack, LoyaltyTransactionKind.Reverse,
                    notification.OriginalOrderId, reason: reason));
            }

            if (reversal.TakeBack > 0 || reversal.GiveBack > 0)
            {
                await db.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            db.ChangeTracker.Clear();
            logger.LogError(ex, "Failed to reverse loyalty points for return {ReturnId}", notification.ReturnOrderId);
        }
    }

    // A sale with no earn or redeem rows either earned nothing or was completed before the ledger began; only the
    // second is read from the programme, so a sale that truly earned nothing never loses points it was not given.
    private async Task<bool> IsFromBeforeLedgerAsync(
        List<LoyaltyTransaction> history, Guid tenantId, DateTime? completedAt, CancellationToken cancellationToken)
    {
        if (history.Any(t => t.Kind is LoyaltyTransactionKind.Earn or LoyaltyTransactionKind.Redeem))
        {
            return false;
        }

        DateTime? ledgerStart = await db.LoyaltyTransactions
            .Where(t => t.TenantId == tenantId && (t.Kind == LoyaltyTransactionKind.Earn || t.Kind == LoyaltyTransactionKind.Redeem))
            .MinAsync(t => (DateTime?)t.CreatedAt, cancellationToken);
        return ledgerStart is null || completedAt is null || completedAt < ledgerStart;
    }
}
