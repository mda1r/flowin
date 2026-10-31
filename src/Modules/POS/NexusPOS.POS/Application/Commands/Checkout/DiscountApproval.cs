using ErrorOr;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;

namespace NexusPOS.POS.Application.Commands.Checkout;

// Owners and managers discount freely; a cashier stays within the branch cap unless the manager PIN approves more.
internal static class DiscountApproval
{
    // The share of the undiscounted bill given away by hand (line and cart discounts); loyalty points do not count.
    public static decimal ManualDiscountPercent(Order order)
    {
        decimal before = order.Lines.Sum(l => l.LineSubtotal);
        if (before <= 0)
        {
            return 0m;
        }

        decimal manual = order.Lines.Sum(l => l.LineDiscountAmount) + order.DiscountAmount - order.LoyaltyDiscountAmount;
        return Math.Round(manual / before * 100m, 2);
    }

    public static decimal Cap(PosBranchSettings? settings) =>
        settings?.MaxCashierDiscountPercent ?? PosBranchSettings.DefaultMaxCashierDiscountPercent;

    // False: the discount stands as it is. True: it stands once the manager PIN checks out. An error: refused.
    public static ErrorOr<bool> NeedsPin(decimal discountPercent, bool canOverride, PosBranchSettings? settings, string? pin)
    {
        if (discountPercent <= 0 || canOverride)
        {
            return false;
        }

        decimal cap = Cap(settings);
        if (discountPercent <= cap)
        {
            return false;
        }

        if (settings?.ApprovalPinHash is null)
        {
            return PosErrors.DiscountNeedsManager(cap);
        }

        if (string.IsNullOrWhiteSpace(pin))
        {
            return PosErrors.DiscountApprovalRequired(cap);
        }

        return true;
    }
}
