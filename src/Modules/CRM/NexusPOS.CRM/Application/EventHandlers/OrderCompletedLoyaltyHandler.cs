using ErrorOr;
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

// On a completed sale for a known customer: deduct the points redeemed on the order, then add the points earned
// on the amount paid under the store's programme (none while it is switched off). Failures are logged and never undo the sale.
internal sealed class OrderCompletedLoyaltyHandler(CrmDbContext db, ILogger<OrderCompletedLoyaltyHandler> logger)
    : INotificationHandler<OrderCompletedDomainEvent>
{
    public async Task Handle(OrderCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        if (notification.CustomerId is not Guid customerId)
        {
            return;
        }

        try
        {
            CustomerId id = new(customerId);
            Customer? customer = await db.Customers
                .FirstOrDefaultAsync(c => c.TenantId == notification.TenantId && c.Id == id, cancellationToken);
            if (customer is null)
            {
                logger.LogWarning("Order {OrderId} references unknown customer {CustomerId}", notification.OrderId, customerId);
                return;
            }

            if (notification.LoyaltyPointsRedeemed > 0)
            {
                ErrorOr<Success> redeemed = customer.RedeemLoyaltyPoints(notification.LoyaltyPointsRedeemed);
                if (redeemed.IsError)
                {
                    logger.LogError(
                        "Order {OrderId} redeemed {Points} points but customer {CustomerId} could not cover them: {Error}",
                        notification.OrderId, notification.LoyaltyPointsRedeemed, customerId, redeemed.FirstError.Description);
                }
            }

            LoyaltyRules rules = await CustomerLoyaltyDirectory.LoadRulesAsync(db, notification.TenantId, cancellationToken);
            int earned = rules.PointsEarned(notification.Total);
            if (earned > 0)
            {
                customer.AddLoyaltyPoints(earned);
            }

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            db.ChangeTracker.Clear();
            logger.LogError(ex, "Failed to update loyalty points for order {OrderId}", notification.OrderId);
        }
    }
}
