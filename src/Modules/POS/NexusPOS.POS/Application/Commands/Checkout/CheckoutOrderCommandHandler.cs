using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Application.Commands.Checkout;

internal sealed class CheckoutOrderCommandHandler(
    PosDbContext db,
    ICustomerLoyaltyDirectory loyalty,
    IOrderNumberSequence numbers,
    IVariantPriceDirectory prices,
    IRecipeCostDirectory recipeCosts,
    IModifierOptionDirectory modifierOptions,
    IDiscountCodeDirectory discountCodes,
    IPublisher publisher)
    : ICommandHandler<CheckoutOrderCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(CheckoutOrderCommand request, CancellationToken cancellationToken)
    {
        Order? existing = await FindByReference(request.ClientReference, cancellationToken);
        if (existing is not null)
        {
            return await Replay(request, existing, cancellationToken);
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

        // A sale that synced after its shift closed is dated into the shift open now, so its cash is still counted.
        DateTime? shiftBoundary = request.OfflineCreatedAt is null
            ? null
            : await db.CashierShifts
                .Where(s => s.BranchId == request.BranchId)
                .MaxAsync(s => (DateTime?)(s.ClosedAt ?? s.OpenedAt), cancellationToken);

        // An owner's discount code, read for the caller's tenant only. Online the sale carries the code's own value;
        // an offline sale must have been made while the code was usable, at the time the sale is recorded.
        DateTime usableAt = offline ? CheckoutBuilder.SaleTime(request.OfflineCreatedAt, now, shiftBoundary) ?? now : now;
        DiscountCodeLookup? code = string.IsNullOrWhiteSpace(request.DiscountCode)
            ? null
            : await discountCodes.FindAsync(request.TenantId, request.DiscountCode, usableAt, cancellationToken);
        DiscountCodeCheck.Outcome coded = DiscountCodeCheck.Apply(request, code, offline);
        if (coded.Error is Error codeError)
        {
            return codeError;
        }

        if (coded.Review is not null)
        {
            review.Add(coded.Review);
        }

        request = coded.Command;

        // The add-ons are read for the caller's tenant only, with the rules of every group on the drinks sold, so a
        // required choice the till skipped is caught as well as an option that is off or belongs to another drink.
        List<Guid> variantIds = [.. request.Lines.Select(l => l.VariantId).Distinct()];
        IReadOnlyDictionary<Guid, Guid> productOf = await prices.GetProductIdsAsync(variantIds, cancellationToken);
        ModifierLookup modifiers = await modifierOptions.GetAsync(
            request.TenantId,
            [.. request.Lines.SelectMany(l => l.ModifierOptionIds ?? []).Distinct()],
            [.. productOf.Values.Distinct()],
            cancellationToken);

        // Managers may reprice at the till.
        if (!request.ByOwnerOrManager)
        {
            IReadOnlyDictionary<Guid, decimal> shelf = await prices.GetSalePricesAsync(variantIds, cancellationToken);
            ErrorOr<Success> priced = CatalogPriceCheck.Check(request, shelf, modifiers);
            if (priced.IsError && !offline)
            {
                return priced.Errors;
            }

            if (priced.IsError)
            {
                review.Add($"سعر أقل من الكتالوج: {string.Join("، ", CatalogPriceCheck.Unverified(request, shelf, modifiers))}");
            }
        }

        // Managers too: an add-on that is off, or a required choice left out, is a drink the barista cannot make.
        ErrorOr<Success> picked = ModifierCheck.Check(request, productOf, modifiers);
        if (picked.IsError && !offline)
        {
            return picked.Errors;
        }

        if (picked.IsError)
        {
            review.Add($"إضافات لا تطابق الكتالوج: {string.Join("، ", ModifierCheck.Unverified(request, productOf, modifiers))}");
        }

        // Gross profit uses what the drink costs the store now, worked out here; whatever cost the till sends is ignored.
        // A sale synced from offline goes through the same rule, valued at the cost when it reaches the server.
        Dictionary<Guid, decimal> unitCosts = CheckoutBuilder.UnitCosts(
            await recipeCosts.GetCostsAsync(request.TenantId, variantIds, cancellationToken),
            await prices.GetCostPricesAsync(variantIds, cancellationToken));

        // Build once without a number first, so a rejected sale never uses up an invoice number.
        ErrorOr<Order> draft = CheckoutBuilder.Build(
            request, rules.Value, notBefore: shiftBoundary, offline: offline, unitCosts: unitCosts, modifiers: modifiers);
        if (draft.IsError)
        {
            return draft.Errors;
        }

        // Online, a code edited after the till applied it would charge the customer one amount and record another, so
        // the till checks the code again. Offline the customer paid the till's amount: it stands, as a cashier discount.
        bool approvedByCode = coded.ApprovedByCode;
        if (DiscountCodeCheck.Changed(coded, draft.Value))
        {
            if (!offline)
            {
                return PosErrors.DiscountCodeChanged;
            }

            approvedByCode = false;
            review.Add($"كود الخصم {code!.Code} تغيّر: الكاشير طبّق {DiscountCodeCheck.Describe(request.DiscountType, request.DiscountValue, request.TaxRate)} وقيمته الآن {DiscountCodeCheck.Describe(coded.MustMatch!.Type, coded.MustMatch.Value, request.TaxRate)}");
        }

        if (DiscountCodeCheck.BelowMinimum(code, draft.Value))
        {
            if (!offline)
            {
                return PosErrors.DiscountCodeMinOrder;
            }

            review.Add($"كود الخصم {code!.Code} على طلب أقل من حده الأدنى {code.MinOrderAmount:0.00}");
        }

        if (offline)
        {
            string? overCap = await OverCapAsync(request, draft.Value, approvedByCode, cancellationToken);
            if (overCap is not null)
            {
                review.Add(overCap);
            }

            if (CheckoutBuilder.PaymentProblem(request, Math.Round(draft.Value.TotalAmount, 2)) is { } payment)
            {
                review.Add(payment.Review);
            }
        }
        else
        {
            ErrorOr<Success> approved = await ApproveDiscountAsync(request, draft.Value, approvedByCode, now, cancellationToken);
            if (approved.IsError)
            {
                return approved.Errors;
            }
        }

        // The number and the sale commit together: if the save fails, the counter rolls back with it.
        await using IDbContextTransaction transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        long number = await numbers.NextAsync(request.TenantId, cancellationToken);
        ErrorOr<Order> built = CheckoutBuilder.Build(request, rules.Value, number, shiftBoundary, offline, unitCosts, modifiers);
        if (built.IsError)
        {
            return built.Errors;
        }

        Order order = built.Value;
        List<IDomainEvent> events = [.. order.DomainEvents];
        order.ClearDomainEvents();
        db.Orders.Add(order);
        if (review.Count > 0)
        {
            db.ActivityLogs.Add(ActivityLog.Create(
                request.BranchId, request.UserId, request.UserName ?? "كاشير", null, "order",
                "بيع دون اتصال يحتاج مراجعة", $"الطلب {number}: {string.Join("؛ ", review)}", now));
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // The same sale arrived twice at once and the other request saved it first.
            await transaction.RollbackAsync(cancellationToken);
            db.ChangeTracker.Clear();
            existing = await FindByReference(request.ClientReference, cancellationToken);
            if (existing is null)
            {
                throw;
            }

            return await Replay(request, existing, cancellationToken);
        }

        // Published once committed, as SaveChanges does, so other modules never act on a sale that rolled back.
        foreach (IDomainEvent domainEvent in events)
        {
            await publisher.Publish(domainEvent, cancellationToken);
        }

        // One use per sale: a resend with the same reference replays above and never gets here. Counted even if the
        // till hangs up now, because the sale is already saved.
        if (coded.Redeem && order.DiscountCode is string usedCode)
        {
            await discountCodes.RedeemAsync(request.TenantId, usedCode, CancellationToken.None);
        }

        return await Done(request, order, cancellationToken);
    }

    // The reference is unique across the store, so one already used by another branch is a clean conflict, not a crash.
    private async Task<ErrorOr<OrderResponse>> Replay(CheckoutOrderCommand request, Order existing, CancellationToken ct) =>
        existing.BranchId == request.BranchId ? await Done(request, existing, ct) : PosErrors.ClientReferenceInUse;

    // A resent sale asks for its kitchen ticket again; the kitchen keeps one ticket per order, so a ticket that
    // failed the first time is made now and one that already exists is left alone.
    private async Task<ErrorOr<OrderResponse>> Done(CheckoutOrderCommand request, Order order, CancellationToken ct)
    {
        if (request.Kitchen is { } kitchen)
        {
            await publisher.Publish(new KitchenTicketRequestedDomainEvent(
                order.TenantId,
                order.BranchId,
                order.Id.Value,
                order.Number,
                kitchen.Takeaway ? null : kitchen.TableNumber,
                kitchen.Takeaway,
                [.. order.Lines.Select(l => new KitchenTicketRequestedDomainEvent.Line(
                    l.VariantId, l.ProductName, l.VariantName, l.Quantity, l.Notes,
                    l.Modifiers is null ? null : [.. l.Modifiers.Select(m => m.Name)]))],
                string.IsNullOrWhiteSpace(kitchen.CallName) ? null : kitchen.CallName.Trim()), ct);
        }

        return OrderMapper.ToResponse(order);
    }

    // approvedByCode: the cart discount came from a usable discount code at its own value, so only line discounts count.
    private async Task<ErrorOr<Success>> ApproveDiscountAsync(
        CheckoutOrderCommand request, Order draft, bool approvedByCode, DateTime now, CancellationToken ct)
    {
        decimal percent = DiscountApproval.ManualDiscountPercent(draft, approvedByCode);
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

    // For a sale made offline: a cashier discount past today's cap, described for the manager's review. A code that was
    // deleted, unusable at the sale's time or charged at another value counts as a cashier discount here.
    private async Task<string?> OverCapAsync(CheckoutOrderCommand request, Order draft, bool approvedByCode, CancellationToken ct)
    {
        decimal percent = DiscountApproval.ManualDiscountPercent(draft, approvedByCode);
        if (percent <= 0 || request.ByOwnerOrManager)
        {
            return null;
        }

        decimal cap = DiscountApproval.Cap(await LoadSettingsAsync(request.BranchId, ct));
        return percent > cap ? $"خصم {percent:0.##}% فوق حد الكاشير {cap:0.##}%" : null;
    }

    private Task<PosBranchSettings?> LoadSettingsAsync(Guid branchId, CancellationToken ct) =>
        db.PosBranchSettings.AsNoTracking().FirstOrDefaultAsync(s => s.BranchId == branchId, ct);

    private Task<Order?> FindByReference(Guid clientReference, CancellationToken ct) =>
        db.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.ClientReference == clientReference, ct);
}
