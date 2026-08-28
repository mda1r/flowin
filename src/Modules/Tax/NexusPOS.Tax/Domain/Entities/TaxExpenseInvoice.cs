namespace NexusPOS.Tax.Domain.Entities;

public sealed class TaxExpenseInvoice
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid? PeriodId { get; private set; }
    public string SupplierName { get; private set; } = string.Empty;
    public string? SupplierVatNumber { get; private set; }
    public string InvoiceNumber { get; private set; } = string.Empty;
    public DateOnly InvoiceDate { get; private set; }
    public decimal BaseAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal TaxRate { get; private set; }
    public string Currency { get; private set; } = "SAR";
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private TaxExpenseInvoice() { }

    public static TaxExpenseInvoice Create(
        Guid tenantId,
        Guid? periodId,
        string supplierName,
        string? supplierVatNumber,
        string invoiceNumber,
        DateOnly invoiceDate,
        decimal baseAmount,
        decimal taxAmount,
        decimal taxRate,
        string currency = "SAR",
        string? notes = null)
    {
        return new TaxExpenseInvoice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PeriodId = periodId,
            SupplierName = supplierName,
            SupplierVatNumber = supplierVatNumber?.Trim(),
            InvoiceNumber = invoiceNumber,
            InvoiceDate = invoiceDate,
            BaseAmount = baseAmount,
            TaxAmount = taxAmount,
            TaxRate = taxRate,
            Currency = currency,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
        };
    }
}
