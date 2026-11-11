namespace NexusPOS.SharedKernel.Application.Services;

// Whether a shop charges VAT. Shops that are not VAT-registered sell at their listed price with no tax at all:
// no VAT on the sale, the invoice or the reports. Every shop charges VAT until its owner switches it off.
public interface ITenantVatPolicy
{
    Task<bool> IsVatEnabledAsync(Guid tenantId, CancellationToken cancellationToken);
}

public static class Vat
{
    public const decimal SaudiRate = 0.15m;

    public static decimal RateFor(bool enabled) => enabled ? SaudiRate : 0m;
}
