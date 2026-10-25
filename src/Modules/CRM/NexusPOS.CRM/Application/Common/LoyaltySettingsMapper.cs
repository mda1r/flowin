using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.CRM.Application.Common;

internal static class LoyaltySettingsMapper
{
    public static LoyaltySettingsResponse ToResponse(LoyaltyRules r) =>
        new(r.Enabled, r.PointsPerCurrencyUnit, r.RedeemPoints, r.RedeemValue, r.MinRedeemPoints);
}
