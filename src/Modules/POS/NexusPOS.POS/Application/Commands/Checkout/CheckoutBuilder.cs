using ErrorOr;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Application.Commands.Checkout;

// Builds and completes the order entirely in memory, so nothing is saved unless every step succeeds.
internal static class CheckoutBuilder
{
    public static ErrorOr<Order> Build(CheckoutOrderCommand cmd, LoyaltyRules loyalty, long? number = null)
    {
        Order order = Order.Create(cmd.TenantId, cmd.BranchId, cmd.Currency, cmd.CustomerId, cmd.TaxRate);
        order.TagClientReference(cmd.ClientReference, cmd.OfflineCreatedAt);

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
        ErrorOr<Success> completed = order.Complete(cmd.PaymentMethod, tendered, cmd.CashAmount, cmd.CardAmount);
        return completed.IsError ? completed.Errors : order;
    }
}
