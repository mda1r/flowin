using ErrorOr;
using NexusPOS.POS.Domain.Entities;

namespace NexusPOS.POS.Application.Commands.Checkout;

// Builds and completes the order entirely in memory, so nothing is saved unless every step succeeds.
internal static class CheckoutBuilder
{
    public static ErrorOr<Order> Build(CheckoutOrderCommand cmd)
    {
        Order order = Order.Create(cmd.TenantId, cmd.BranchId, cmd.Currency, cmd.CustomerId, cmd.TaxRate);
        order.TagClientReference(cmd.ClientReference, cmd.OfflineCreatedAt);

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
            ErrorOr<Success> redeemed = order.RedeemLoyaltyPoints(cmd.LoyaltyPoints);
            if (redeemed.IsError)
            {
                return redeemed.Errors;
            }
        }

        // The till computes the total in two decimals; never let a fraction of a halala reject the payment.
        decimal tendered = Math.Max(cmd.AmountTendered, Math.Round(order.TotalAmount, 2));
        ErrorOr<Success> completed = order.Complete(cmd.PaymentMethod, tendered, cmd.CashAmount, cmd.CardAmount);
        return completed.IsError ? completed.Errors : order;
    }
}
