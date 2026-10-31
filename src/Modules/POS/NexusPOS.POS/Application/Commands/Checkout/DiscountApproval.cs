using ErrorOr;
using NexusPOS.POS.Application.Common;
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

    public static ErrorOr<Success> Check(
        decimal discountPercent, bool canOverride, PosBranchSettings? settings, string? pin, DateTime now)
    {
        if (discountPercent <= 0 || canOverride)
        {
            return Result.Success;
        }

        decimal cap = settings?.MaxCashierDiscountPercent ?? PosBranchSettings.DefaultMaxCashierDiscountPercent;
        if (discountPercent <= cap)
        {
            return Result.Success;
        }

        if (settings?.ApprovalPinHash is null)
        {
            return PosErrors.DiscountNeedsManager(cap);
        }

        if (string.IsNullOrWhiteSpace(pin))
        {
            return PosErrors.DiscountApprovalRequired(cap);
        }

        return settings.CheckPin(pin.Trim(), ApprovalPinHasher.Verify, now);
    }
}
