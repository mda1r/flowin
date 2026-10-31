using ErrorOr;
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

    // notBefore is the branch's latest shift boundary: a synced sale is never dated into a shift whose totals are closed.
    public static ErrorOr<Order> Build(CheckoutOrderCommand cmd, LoyaltyRules loyalty, long? number = null, DateTime? notBefore = null)
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

        // The till computes the total in two decimals; never let a fraction of a halala reject the payment.
        if (number is long n)
        {
            order.AssignNumber(n);
        }

        decimal tendered = Math.Max(cmd.AmountTendered, Math.Round(order.TotalAmount, 2));
        ErrorOr<Success> completed = order.Complete(
            cmd.PaymentMethod, tendered, cmd.CashAmount, cmd.CardAmount, SaleTime(offlineAt, DateTime.UtcNow, notBefore));
        return completed.IsError ? completed.Errors : order;
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
