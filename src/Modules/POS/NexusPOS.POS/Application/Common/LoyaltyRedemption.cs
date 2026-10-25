using ErrorOr;
using NexusPOS.POS.Domain;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Application.Common;

// Checks a redemption against the store's programme and the customer's balance before it touches an order.
internal static class LoyaltyRedemption
{
    public static async Task<ErrorOr<LoyaltyRules>> CheckAsync(
        ICustomerLoyaltyDirectory loyalty, Guid tenantId, Guid? customerId, int points, CancellationToken ct)
    {
        LoyaltyRules rules = await loyalty.GetRulesAsync(tenantId, ct);
        if (points <= 0 || customerId is not Guid id)
        {
            return rules;
        }

        if (!rules.Enabled)
        {
            return PosErrors.LoyaltyDisabled;
        }

        if (points < rules.MinRedeemPoints)
        {
            return PosErrors.LoyaltyBelowMinimum(rules.MinRedeemPoints);
        }

        int? available = await loyalty.GetPointsAsync(tenantId, id, ct);
        if (available is null || available < points)
        {
            return PosErrors.InsufficientLoyaltyPoints;
        }

        return rules;
    }
}
