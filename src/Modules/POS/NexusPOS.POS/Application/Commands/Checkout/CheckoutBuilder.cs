using ErrorOr;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Application.Commands.Checkout;

// Builds and completes the order entirely in memory, so nothing is saved unless every step succeeds.
internal static class CheckoutBuilder
{
    // catalogPrices: listed sale prices (VAT included) by variant. A cashier's line may not be cheaper than the
    // catalog, so a lowered price cannot stand in for a discount; owners and managers may override.
    public static ErrorOr<Order> Build(
        CheckoutOrderCommand cmd,
        LoyaltyRules loyalty,
        long? number = null,
        IReadOnlyDictionary<Guid, decimal>? catalogPrices = null)
    {
        Order order = Order.Create(cmd.TenantId, cmd.BranchId, cmd.Currency, cmd.CustomerId, cmd.TaxRate);
        order.TagClientReference(cmd.ClientReference, cmd.OfflineCreatedAt);

        foreach (CheckoutOrderCommand.Line line in cmd.Lines)
        {
            if (!cmd.IsManager && catalogPrices is not null && catalogPrices.TryGetValue(line.VariantId, out decimal listed)
                && Math.Round(line.UnitPrice * (1 + cmd.TaxRate), 2) < Math.Round(listed, 2) - 0.01m)
            {
                return PosErrors.PriceBelowCatalog(line.ProductName);
            }

            ErrorOr<OrderLine> added = order.AddLine(
                line.VariantId, line.ProductName, line.VariantName, line.UnitPrice, line.CostPrice, line.Quantity,
                notes: line.Notes);
            if (added.IsError)
            {
                return added.Errors;
            }
        }

        // The order discount comes off the bill before loyalty points, as in Order's totals.
        if (cmd.DiscountType != DiscountType.None && cmd.DiscountValue > 0)
        {
            ErrorOr<Success> discounted = order.ApplyDiscount(cmd.DiscountType, cmd.DiscountValue);
            if (discounted.IsError)
            {
                return discounted.Errors;
            }

            decimal share = order.SubtotalAmount > 0
                ? order.OrderDiscount.ComputeAmount(order.SubtotalAmount) / order.SubtotalAmount * 100m
                : 0m;
            if (!cmd.IsManager && share > CheckoutOrderCommand.CashierDiscountCapPercent + 0.01m)
            {
                return PosErrors.DiscountAboveCashierLimit(CheckoutOrderCommand.CashierDiscountCapPercent);
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
        ErrorOr<Success> completed = order.Complete(cmd.PaymentMethod, tendered, cmd.CashAmount, cmd.CardAmount);
        return completed.IsError ? completed.Errors : order;
    }
}
