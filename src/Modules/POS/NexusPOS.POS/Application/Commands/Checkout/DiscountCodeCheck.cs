using ErrorOr;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.POS.Application.Commands.Checkout;

// An owner's discount code typed at the till. The discount comes from the code as the server keeps it; whatever
// discount the till sent with it is ignored. Online, a code that cannot be used refuses the sale. A sale made offline
// already happened with the code the till checked while it was online, so it keeps its discount and leaves a note.
internal static class DiscountCodeCheck
{
    // Command is the sale to build: the code's discount in place, and the code itself in its stored form.
    // Redeem says whether the sale counts a use of the code once it is saved.
    public sealed record Outcome(CheckoutOrderCommand Command, Error? Error, string? Review, bool Redeem);

    public static Outcome Apply(CheckoutOrderCommand cmd, DiscountCodeLookup? code, bool offline)
    {
        if (string.IsNullOrWhiteSpace(cmd.DiscountCode))
        {
            return new(cmd with { DiscountCode = null }, null, null, false);
        }

        string typed = cmd.DiscountCode.Trim().ToUpperInvariant();
        if (code is null)
        {
            // Deleted since the till checked it: the sale keeps the discount the till applied then.
            return offline
                ? new(cmd with { DiscountCode = typed }, null, $"كود الخصم {typed} لم يعد موجوداً", false)
                : new(cmd, PosErrors.DiscountCodeRejected(null), null, false);
        }

        CheckoutOrderCommand coded = cmd with
        {
            DiscountCode = code.Code,
            DiscountType = code.IsPercentage ? DiscountType.Percentage : DiscountType.Fixed,

            // A fixed code is an amount with VAT included; the order discount is net, like the line prices.
            DiscountValue = code.IsPercentage ? code.Value : Math.Round(code.Value / (1 + cmd.TaxRate), 4),
        };

        if (code.Problem is null)
        {
            return new(coded, null, null, true);
        }

        return offline
            ? new(coded, null, $"كود الخصم {code.Code}: {code.Problem}", true)
            : new(cmd, PosErrors.DiscountCodeRejected(code.Problem), null, false);
    }

    // The code's minimum is the bill with VAT before the order discount, as the customer sees it on the menu.
    public static bool BelowMinimum(DiscountCodeLookup? code, Order draft) =>
        code is { MinOrderAmount: > 0 } && Math.Round(draft.SubtotalAmount * (1 + draft.TaxRate), 2) < code.MinOrderAmount;
}
