using ErrorOr;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.POS.Application.Commands.Checkout;

// An owner's discount code typed at the till. Online, the sale is priced from the code as the server keeps it, and a
// code that cannot be used, or whose value changed since the till applied it, refuses the sale before the customer
// pays the wrong amount. A sale made offline already happened: it keeps the discount the till charged and leaves a
// note when the code no longer agrees with it. Only a code that was usable when the sale was made, at the value the
// till charged, counts as the owner's approval; anything else is a cashier discount and goes through the cap review.
internal static class DiscountCodeCheck
{
    // Command is the sale to build, with the code itself in its stored form. Redeem says whether the sale counts a
    // use of the code once it is saved. ApprovedByCode says the cart discount came from a usable code, so it is not
    // held to the cashier cap. MustMatch is the discount the built sale is compared with (see Changed): online the
    // till's, offline the code's current terms.
    public sealed record Outcome(
        CheckoutOrderCommand Command, Error? Error, string? Review, bool Redeem, bool ApprovedByCode = false, Terms? MustMatch = null);

    public sealed record Terms(DiscountType Type, decimal Value);

    public static Outcome Apply(CheckoutOrderCommand cmd, DiscountCodeLookup? code, bool offline)
    {
        if (string.IsNullOrWhiteSpace(cmd.DiscountCode))
        {
            return new(cmd with { DiscountCode = null }, null, null, false);
        }

        string typed = cmd.DiscountCode.Trim().ToUpperInvariant();
        if (code is null)
        {
            // Deleted since the till checked it: the sale keeps the discount the till applied then, as a cashier discount.
            return offline
                ? new(cmd with { DiscountCode = typed }, null, $"كود الخصم {typed} لم يعد موجوداً ({Describe(cmd.DiscountType, cmd.DiscountValue, cmd.TaxRate)})", false)
                : new(cmd, PosErrors.DiscountCodeRejected(null), null, false);
        }

        // A fixed code is an amount with VAT included; the order discount is net, like the line prices.
        DiscountType codeType = code.IsPercentage ? DiscountType.Percentage : DiscountType.Fixed;
        decimal codeValue = code.IsPercentage ? code.Value : Math.Round(code.Value / (1 + cmd.TaxRate), 4);

        if (offline)
        {
            // Problem is worked out at the sale's own time, so a code that expired before the sale is not honoured.
            CheckoutOrderCommand kept = cmd with { DiscountCode = code.Code };
            return new(
                kept,
                null,
                code.Problem is null ? null : $"كود الخصم {code.Code}: {code.Problem}",
                true,
                ApprovedByCode: code.Problem is null,
                MustMatch: new Terms(codeType, codeValue));
        }

        if (code.Problem is not null)
        {
            return new(cmd, PosErrors.DiscountCodeRejected(code.Problem), null, false);
        }

        return new(
            cmd with { DiscountCode = code.Code, DiscountType = codeType, DiscountValue = codeValue },
            null,
            null,
            true,
            ApprovedByCode: true,
            MustMatch: new Terms(cmd.DiscountType, cmd.DiscountValue));
    }

    // True when the cart discount the sale was built with and the outcome's MustMatch take a different amount off this
    // bill (compared with VAT, to the halala, so the till's rounding of a fixed code never counts as a change). Terms no
    // discount can have (negative, or over 100%) never match.
    public static bool Changed(Outcome outcome, Order draft)
    {
        if (outcome.MustMatch is not Terms terms)
        {
            return false;
        }

        ErrorOr<Discount> other = Discount.Create(terms.Type, terms.Value);
        if (other.IsError)
        {
            return true;
        }

        decimal built = draft.DiscountAmount - draft.LoyaltyDiscountAmount;
        decimal expected = other.Value.ComputeAmount(draft.SubtotalAmount);
        return Math.Abs(Math.Round(built * (1 + draft.TaxRate), 2) - Math.Round(expected * (1 + draft.TaxRate), 2)) > 0.01m;
    }

    // "خصم 10%" or "خصم 5.75 ريال" for a review note; a fixed value is net, shown with VAT as the till showed it.
    public static string Describe(DiscountType type, decimal value, decimal taxRate) => type switch
    {
        DiscountType.Percentage => $"خصم {value:0.##}%",
        DiscountType.Fixed => $"خصم {Math.Round(value * (1 + taxRate), 2):0.00} ريال",
        _ => "بلا خصم",
    };

    // The code's minimum is the bill with VAT before the order discount, as the customer sees it on the menu.
    public static bool BelowMinimum(DiscountCodeLookup? code, Order draft) =>
        code is { MinOrderAmount: > 0 } && Math.Round(draft.SubtotalAmount * (1 + draft.TaxRate), 2) < code.MinOrderAmount;
}
