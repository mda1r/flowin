namespace NexusPOS.CRM.Application.Common;

public sealed record LoyaltySettingsResponse(
    bool Enabled,
    decimal PointsPerCurrencyUnit,
    int RedeemPoints,
    decimal RedeemValue,
    int MinRedeemPoints);
