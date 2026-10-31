using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Application.Commands.Checkout;

internal sealed class CheckoutOrderCommandHandler(
    PosDbContext db, ICustomerLoyaltyDirectory loyalty, IOrderNumberSequence numbers, IVariantPriceDirectory prices)
    : ICommandHandler<CheckoutOrderCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(CheckoutOrderCommand request, CancellationToken cancellationToken)
    {
        Order? existing = await FindByReference(request, cancellationToken);
        if (existing is not null)
        {
            return OrderMapper.ToResponse(existing);
        }

        ErrorOr<LoyaltyRules> rules = await LoyaltyRedemption.CheckAsync(
            loyalty, request.TenantId, request.CustomerId, request.LoyaltyPoints, cancellationToken);
        if (rules.IsError)
        {
            return rules.Errors;
        }

        // Managers may reprice at the till, and a sale rung up offline keeps the price the till showed then.
        if (!request.ByOwnerOrManager && request.OfflineCreatedAt is null)
        {
            IReadOnlyDictionary<Guid, decimal> shelf = await prices.GetSalePricesAsync(
                [.. request.Lines.Select(l => l.VariantId)], cancellationToken);
            ErrorOr<Success> priced = CatalogPriceCheck.Check(request, shelf);
            if (priced.IsError)
            {
                return priced.Errors;
            }
        }

        // Build once without a number first, so a rejected sale never uses up an invoice number.
        ErrorOr<Order> draft = CheckoutBuilder.Build(request, rules.Value);
        if (draft.IsError)
        {
            return draft.Errors;
        }

        ErrorOr<Success> approved = await ApproveDiscountAsync(request, draft.Value, cancellationToken);
        if (approved.IsError)
        {
            return approved.Errors;
        }

        long number = await numbers.NextAsync(request.TenantId, cancellationToken);
        ErrorOr<Order> built = CheckoutBuilder.Build(request, rules.Value, number);
        if (built.IsError)
        {
            return built.Errors;
        }

        db.Orders.Add(built.Value);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // The same sale arrived twice at once and the other request saved it first.
            db.ChangeTracker.Clear();
            existing = await FindByReference(request, cancellationToken);
            if (existing is null)
            {
                throw;
            }

            return OrderMapper.ToResponse(existing);
        }

        return OrderMapper.ToResponse(built.Value);
    }

    private async Task<ErrorOr<Success>> ApproveDiscountAsync(CheckoutOrderCommand request, Order draft, CancellationToken ct)
    {
        decimal percent = DiscountApproval.ManualDiscountPercent(draft);
        if (percent <= 0 || request.ByOwnerOrManager)
        {
            return Result.Success;
        }

        PosBranchSettings? settings = await db.PosBranchSettings.FirstOrDefaultAsync(s => s.BranchId == request.BranchId, ct);
        int attempts = settings?.FailedPinAttempts ?? 0;
        DateTime? lockedUntil = settings?.PinLockedUntil;
        ErrorOr<Success> result = DiscountApproval.Check(percent, false, settings, request.ApprovalPin, DateTime.UtcNow);

        // Keep the wrong-PIN count even though the sale is refused.
        if (settings is not null && (settings.FailedPinAttempts != attempts || settings.PinLockedUntil != lockedUntil))
        {
            await db.SaveChangesAsync(ct);
        }

        return result;
    }

    private Task<Order?> FindByReference(CheckoutOrderCommand request, CancellationToken ct) =>
        db.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.ClientReference == request.ClientReference && o.BranchId == request.BranchId, ct);
}
