using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
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

        // A sale rung up offline was already made: it keeps the price and discount the till accepted then, and
        // whatever the server would refuse now is logged for the manager to review instead.
        DateTime now = DateTime.UtcNow;
        bool offline = OfflineSale.IsOffline(request.OfflineCreatedAt, now);
        List<string> review = [];

        // Managers may reprice at the till.
        if (!request.ByOwnerOrManager)
        {
            IReadOnlyDictionary<Guid, decimal> shelf = await prices.GetSalePricesAsync(
                [.. request.Lines.Select(l => l.VariantId)], cancellationToken);
            ErrorOr<Success> priced = CatalogPriceCheck.Check(request, shelf);
            if (priced.IsError && !offline)
            {
                return priced.Errors;
            }

            if (priced.IsError)
            {
                review.Add($"سعر أقل من الكتالوج: {string.Join("، ", CatalogPriceCheck.Unverified(request, shelf))}");
            }
        }

        // Build once without a number first, so a rejected sale never uses up an invoice number.
        ErrorOr<Order> draft = CheckoutBuilder.Build(request, rules.Value);
        if (draft.IsError)
        {
            return draft.Errors;
        }

        if (offline)
        {
            string? overCap = await OverCapAsync(request, draft.Value, cancellationToken);
            if (overCap is not null)
            {
                review.Add(overCap);
            }
        }
        else
        {
            ErrorOr<Success> approved = await ApproveDiscountAsync(request, draft.Value, now, cancellationToken);
            if (approved.IsError)
            {
                return approved.Errors;
            }
        }

        long number = await numbers.NextAsync(request.TenantId, cancellationToken);
        ErrorOr<Order> built = CheckoutBuilder.Build(request, rules.Value, number);
        if (built.IsError)
        {
            return built.Errors;
        }

        db.Orders.Add(built.Value);
        if (review.Count > 0)
        {
            db.ActivityLogs.Add(ActivityLog.Create(
                request.BranchId, request.UserId, request.UserName ?? "كاشير", null, "order",
                "بيع دون اتصال يحتاج مراجعة", $"الطلب {number}: {string.Join("؛ ", review)}", now));
        }

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

    private async Task<ErrorOr<Success>> ApproveDiscountAsync(
        CheckoutOrderCommand request, Order draft, DateTime now, CancellationToken ct)
    {
        decimal percent = DiscountApproval.ManualDiscountPercent(draft);
        if (percent <= 0 || request.ByOwnerOrManager)
        {
            return Result.Success;
        }

        PosBranchSettings? settings = await LoadSettingsAsync(request.BranchId, ct);
        ErrorOr<bool> needsPin = DiscountApproval.NeedsPin(percent, false, settings, request.ApprovalPin);
        if (needsPin.IsError)
        {
            return needsPin.Errors;
        }

        return needsPin.Value
            ? await VerifyPinAsync(request.BranchId, settings!.ApprovalPinHash!, request.ApprovalPin!.Trim(), now, ct)
            : Result.Success;
    }

    // Each try takes a wrong-PIN slot in one UPDATE before the PIN is checked, so parallel guesses cannot share a
    // slot. The fifth slot locks approvals for fifteen minutes; the right PIN clears the count and the lock.
    private async Task<ErrorOr<Success>> VerifyPinAsync(Guid branchId, string pinHash, string pin, DateTime now, CancellationToken ct)
    {
        DateTime? lockedUntil = now + PosBranchSettings.PinLockout;
        int taken = await db.PosBranchSettings
            .Where(s => s.BranchId == branchId && (s.PinLockedUntil == null || s.PinLockedUntil <= now))
            .ExecuteUpdateAsync(
                u => u
                    .SetProperty(
                        s => s.FailedPinAttempts,
                        s => s.FailedPinAttempts + 1 >= PosBranchSettings.MaxPinAttempts ? 0 : s.FailedPinAttempts + 1)
                    .SetProperty(
                        s => s.PinLockedUntil,
                        s => s.FailedPinAttempts + 1 >= PosBranchSettings.MaxPinAttempts ? lockedUntil : s.PinLockedUntil),
                ct);
        if (taken == 0)
        {
            return PosErrors.ApprovalPinLocked;
        }

        if (!ApprovalPinHasher.Verify(pin, pinHash))
        {
            return PosErrors.InvalidApprovalPin;
        }

        await db.PosBranchSettings
            .Where(s => s.BranchId == branchId)
            .ExecuteUpdateAsync(u => u.SetProperty(s => s.FailedPinAttempts, 0).SetProperty(s => s.PinLockedUntil, (DateTime?)null), ct);
        return Result.Success;
    }

    // For a sale made offline: a cashier discount past today's cap, described for the manager's review.
    private async Task<string?> OverCapAsync(CheckoutOrderCommand request, Order draft, CancellationToken ct)
    {
        decimal percent = DiscountApproval.ManualDiscountPercent(draft);
        if (percent <= 0 || request.ByOwnerOrManager)
        {
            return null;
        }

        decimal cap = DiscountApproval.Cap(await LoadSettingsAsync(request.BranchId, ct));
        return percent > cap ? $"خصم {percent:0.##}% فوق حد الكاشير {cap:0.##}%" : null;
    }

    private Task<PosBranchSettings?> LoadSettingsAsync(Guid branchId, CancellationToken ct) =>
        db.PosBranchSettings.AsNoTracking().FirstOrDefaultAsync(s => s.BranchId == branchId, ct);

    private Task<Order?> FindByReference(CheckoutOrderCommand request, CancellationToken ct) =>
        db.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.ClientReference == request.ClientReference && o.BranchId == request.BranchId, ct);
}
