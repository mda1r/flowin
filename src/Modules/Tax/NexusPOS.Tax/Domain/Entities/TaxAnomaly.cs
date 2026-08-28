namespace NexusPOS.Tax.Domain.Entities;

public sealed class TaxAnomaly
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid? PeriodId { get; private set; }
    public string RuleCode { get; private set; } = string.Empty;
    public string Severity { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string? TransactionRef { get; private set; }
    public DateTime DetectedAt { get; private set; }
    public bool IsResolved { get; private set; }
    public DateTime? ResolvedAt { get; private set; }

    private TaxAnomaly() { }

    public static TaxAnomaly Create(
        Guid tenantId,
        Guid? periodId,
        string ruleCode,
        string severity,
        string title,
        string description,
        string? transactionRef = null)
    {
        return new TaxAnomaly
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PeriodId = periodId,
            RuleCode = ruleCode,
            Severity = severity,
            Title = title,
            Description = description,
            TransactionRef = transactionRef,
            DetectedAt = DateTime.UtcNow,
            IsResolved = false,
        };
    }

    public void Resolve()
    {
        IsResolved = true;
        ResolvedAt = DateTime.UtcNow;
    }
}

public static class AnomalySeverity
{
    public const string Info = "info";
    public const string Warning = "warning";
    public const string Error = "error";
}
