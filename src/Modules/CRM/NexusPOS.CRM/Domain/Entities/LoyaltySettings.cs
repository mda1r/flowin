using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.CRM.Domain.Entities;

// The owner's loyalty programme for the store; one row per tenant, created on first save.
public sealed class LoyaltySettings
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public bool Enabled { get; private set; }
    public decimal PointsPerCurrencyUnit { get; private set; }
    public int RedeemPoints { get; private set; }
    public decimal RedeemValue { get; private set; }
    public int MinRedeemPoints { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private LoyaltySettings() { }

    public static LoyaltySettings Create(Guid tenantId)
    {
        LoyaltyRules d = LoyaltyRules.Default;
        return new LoyaltySettings
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Enabled = d.Enabled,
            PointsPerCurrencyUnit = d.PointsPerCurrencyUnit,
            RedeemPoints = d.RedeemPoints,
            RedeemValue = d.RedeemValue,
            MinRedeemPoints = d.MinRedeemPoints,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void Update(LoyaltyRules rules)
    {
        Enabled = rules.Enabled;
        PointsPerCurrencyUnit = rules.PointsPerCurrencyUnit;
        RedeemPoints = rules.RedeemPoints;
        RedeemValue = rules.RedeemValue;
        MinRedeemPoints = rules.MinRedeemPoints;
        UpdatedAt = DateTime.UtcNow;
    }

    public LoyaltyRules ToRules() => new(Enabled, PointsPerCurrencyUnit, RedeemPoints, RedeemValue, MinRedeemPoints);
}
