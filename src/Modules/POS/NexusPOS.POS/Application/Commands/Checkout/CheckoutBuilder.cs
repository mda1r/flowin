using ErrorOr;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Application.Commands.Checkout;

// Builds and completes the order entirely in memory, so nothing is saved unless every step succeeds.
internal static class CheckoutBuilder
{
    // How far back a till's offline clock is trusted when dating a synced sale.
    private static readonly TimeSpan _offlineWindow = TimeSpan.FromHours(72);

    public static ErrorOr<Order> Build(CheckoutOrderCommand cmd, LoyaltyRules loyalty, long? number = null)
    {
        DateTime? offlineAt = AsUtc(cmd.OfflineCreatedAt);
        Order order = Order.Create(cmd.TenantId, cmd.BranchId, cmd.Currency, cmd.CustomerId, cmd.TaxRate);
        order.TagClientReference(cmd.ClientReference, offlineAt);

        foreach (CheckoutOrderCommand.Line line in cmd.Lines)
        {
            ErrorOr<OrderLine> added = order.AddLine(
                line.VariantId, line.ProductName, line.VariantName, line.UnitPrice, line.CostPrice, line.Quantity);
            if (added.IsError)
            {
                return added.Errors;
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
            cmd.PaymentMethod, tendered, cmd.CashAmount, cmd.CardAmount, SaleTime(offlineAt, DateTime.UtcNow));
        return completed.IsError ? completed.Errors : order;
    }

    // A sale rung up offline belongs to the day and shift it happened in, not the moment it synced.
    // A till clock in the future or far in the past is pulled back into range.
    internal static DateTime? SaleTime(DateTime? offlineCreatedAt, DateTime utcNow)
    {
        if (AsUtc(offlineCreatedAt) is not DateTime at)
        {
            return null;
        }

        DateTime earliest = utcNow - _offlineWindow;
        return at > utcNow ? utcNow : at < earliest ? earliest : at;
    }

    private static DateTime? AsUtc(DateTime? value) => value switch
    {
        null => null,
        { Kind: DateTimeKind.Local } v => v.ToUniversalTime(),
        { Kind: DateTimeKind.Unspecified } v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
        _ => value,
    };
}
