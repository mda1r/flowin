namespace NexusPOS.Tax.Domain.Entities;

public sealed class TaxLedgerEntry
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid? PeriodId { get; private set; }
    public string EntryType { get; private set; } = string.Empty;
    public string TransactionType { get; private set; } = string.Empty;
    public Guid? ReferenceId { get; private set; }
    public string? ReferenceType { get; private set; }
    public decimal BaseAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal TaxRate { get; private set; }
    public DateOnly EffectiveDate { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private TaxLedgerEntry() { }

    public static TaxLedgerEntry Create(
        Guid tenantId,
        Guid? periodId,
        string entryType,
        string transactionType,
        decimal baseAmount,
        decimal taxAmount,
        decimal taxRate,
        DateOnly effectiveDate,
        Guid? referenceId = null,
        string? referenceType = null)
    {
        return new TaxLedgerEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PeriodId = periodId,
            EntryType = entryType,
            TransactionType = transactionType,
            BaseAmount = baseAmount,
            TaxAmount = taxAmount,
            TaxRate = taxRate,
            EffectiveDate = effectiveDate,
            ReferenceId = referenceId,
            ReferenceType = referenceType,
            CreatedAt = DateTime.UtcNow,
        };
    }
}

public static class LedgerEntryType
{
    public const string Output = "output";
    public const string Input = "input";
    public const string Adjustment = "adjustment";
}

public static class LedgerTransactionType
{
    public const string Sale = "sale";
    public const string SaleReturn = "sale_return";
    public const string PurchaseInvoice = "purchase_invoice";
    public const string ManualAdjustment = "manual_adjustment";
}
