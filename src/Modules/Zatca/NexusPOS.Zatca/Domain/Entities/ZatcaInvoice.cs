namespace NexusPOS.Zatca.Domain.Entities;

public sealed class ZatcaInvoice
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid OrderId { get; private set; }
    public string InvoiceNumber { get; private set; } = null!;
    public DateTime InvoiceDate { get; private set; }
    public string SellerName { get; private set; } = null!;
    public string SellerVatNumber { get; private set; } = null!;
    public decimal SubtotalAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal TotalAmount { get; private set; }
    public string Currency { get; private set; } = null!;
    public string QrCodeBase64 { get; private set; } = null!;
    public string XmlContent { get; private set; } = null!;
    public ZatcaPhase Phase { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private ZatcaInvoice() { }

    public static ZatcaInvoice Create(
        Guid tenantId,
        Guid orderId,
        string invoiceNumber,
        DateTime invoiceDate,
        string sellerName,
        string sellerVatNumber,
        decimal subtotalAmount,
        decimal taxAmount,
        decimal totalAmount,
        string currency,
        string qrCodeBase64,
        string xmlContent,
        ZatcaPhase phase)
    {
        return new ZatcaInvoice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            InvoiceNumber = invoiceNumber,
            InvoiceDate = invoiceDate,
            SellerName = sellerName,
            SellerVatNumber = sellerVatNumber,
            SubtotalAmount = subtotalAmount,
            TaxAmount = taxAmount,
            TotalAmount = totalAmount,
            Currency = currency,
            QrCodeBase64 = qrCodeBase64,
            XmlContent = xmlContent,
            Phase = phase,
            CreatedAt = DateTime.UtcNow,
        };
    }
}

public enum ZatcaPhase
{
    Phase1 = 1,
    Phase2 = 2,
}
