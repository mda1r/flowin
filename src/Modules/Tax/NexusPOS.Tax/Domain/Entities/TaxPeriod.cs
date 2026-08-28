namespace NexusPOS.Tax.Domain.Entities;

public sealed class TaxPeriod
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public string Status { get; private set; } = TaxPeriodStatus.Open;
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }

    private TaxPeriod() { }

    public static TaxPeriod Create(Guid tenantId, DateOnly startDate, DateOnly endDate, string? notes = null)
    {
        return new TaxPeriod
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StartDate = startDate,
            EndDate = endDate,
            Status = TaxPeriodStatus.Open,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void Close()
    {
        Status = TaxPeriodStatus.Closed;
        ClosedAt = DateTime.UtcNow;
    }
}

public static class TaxPeriodStatus
{
    public const string Open = "open";
    public const string Closed = "closed";
}
