using ErrorOr;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Application.Commands.Checkout;

// Builds and completes the order entirely in memory, so nothing is saved unless every step succeeds.
internal static class CheckoutBuilder
{
    // How far back a till's offline clock is trusted when dating a synced sale.
    private static readonly TimeSpan _offlineWindow = TimeSpan.FromHours(72);

    // A stamp this close to the request is an online sale (or one that only just missed the server): dated now.
    private static readonly TimeSpan _offlineGrace = TimeSpan.FromMinutes(1);

    // The till and the server round the total separately, so they may differ by a halala; anything more is real money.
    internal const decimal HalalaTolerance = 0.01m;

    // notBefore is the branch's latest shift boundary: a synced sale is never dated into a shift whose totals are closed.
    // offline: the sale already happened, so a payment that does not add up is kept (and logged by the handler) instead of refused.
    public static ErrorOr<Order> Build(
        CheckoutOrderCommand cmd, LoyaltyRules loyalty, long? number = null, DateTime? notBefore = null, bool offline = false)
    {
        DateTime? offlineAt = AsUtc(cmd.OfflineCreatedAt);
        Order order = Order.Create(cmd.TenantId, cmd.BranchId, cmd.Currency, cmd.CustomerId, cmd.TaxRate);
        order.TagClientReference(cmd.ClientReference, offlineAt);

        foreach (CheckoutOrderCommand.Line line in cmd.Lines)
        {
            ErrorOr<Discount> lineDiscount = Discount.Create(line.DiscountType, line.DiscountValue);
            if (lineDiscount.IsError)
            {
                return lineDiscount.Errors;
            }

            ErrorOr<OrderLine> added = order.AddLine(
                line.VariantId, line.ProductName, line.VariantName, line.UnitPrice, line.CostPrice, line.Quantity, lineDiscount.Value,
                line.Notes);
            if (added.IsError)
            {
                return added.Errors;
            }
        }

        // The cashier's cart discount comes off before loyalty, so points can never pay for more than what is left.
        if (cmd.DiscountType != DiscountType.None)
        {
            ErrorOr<Success> discounted = order.ApplyDiscount(cmd.DiscountType, cmd.DiscountValue);
            if (discounted.IsError)
            {
                return discounted.Errors;
            }
        }

        if (cmd.LoyaltyPoints > 0)
        {
            ErrorOr<Success> redeemed = order.RedeemLoyaltyPoints(cmd.LoyaltyPoints, loyalty.ValuePerPoint);
            if (redeemed.IsError)
            {
                return redeemed.Errors;
            }
        }

        if (number is long n)
        {
            order.AssignNumber(n);
        }

        // The till computes the total in two decimals; a halala of rounding is lifted to the total, never refused.
        decimal total = Math.Round(order.TotalAmount, 2);
        if (!offline && PaymentProblem(cmd, total) is { } problem)
        {
            return problem.Error;
        }

        decimal tendered = Math.Max(cmd.AmountTendered, total);
        ErrorOr<Success> completed = order.Complete(
            cmd.PaymentMethod, tendered, cmd.CashAmount, cmd.CardAmount, SaleTime(offlineAt, DateTime.UtcNow, notBefore));
        return completed.IsError ? completed.Errors : order;
    }

    // Cash handed over short of the total, or a split whose parts do not add up to it. Online the sale is refused
    // with Error; a sale made offline is kept and Review goes to the manager. Card and digital charge the total.
    internal static (Error Error, string Review)? PaymentProblem(CheckoutOrderCommand cmd, decimal total)
    {
        if (cmd.PaymentMethod == PaymentMethod.Cash && cmd.AmountTendered < total - HalalaTolerance)
        {
            return (PosErrors.InsufficientPayment, $"نقد مستلم {cmd.AmountTendered:0.00} أقل من الإجمالي {total:0.00}");
        }

        decimal cash = cmd.CashAmount ?? 0m;
        decimal card = cmd.CardAmount ?? 0m;
        if (cmd.PaymentMethod == PaymentMethod.Split && Math.Abs(cash + card - total) > HalalaTolerance)
        {
            return (PosErrors.SplitMismatch, $"دفع مقسّم نقد {cash:0.00} وبطاقة {card:0.00} لا يساوي الإجمالي {total:0.00}");
        }

        return null;
    }

    // A sale rung up offline keeps the time it happened, but never earlier than the start of a shift still open
    // (so its cash is in a shift that has yet to close) nor older than the offline window. Null means "now":
    // no stamp, a recent one, or a till clock in the future.
    internal static DateTime? SaleTime(DateTime? offlineCreatedAt, DateTime utcNow, DateTime? notBefore = null)
    {
        if (AsUtc(offlineCreatedAt) is not DateTime at || at > utcNow - _offlineGrace)
        {
            return null;
        }

        DateTime earliest = utcNow - _offlineWindow;
        if (AsUtc(notBefore) is DateTime boundary && boundary > earliest)
        {
            earliest = boundary < utcNow ? boundary : utcNow;
        }

        return at < earliest ? earliest : at;
    }

    private static DateTime? AsUtc(DateTime? value) => value switch
    {
        null => null,
        { Kind: DateTimeKind.Local } v => v.ToUniversalTime(),
        { Kind: DateTimeKind.Unspecified } v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
        _ => value,
    };
}
