using NexusPOS.Zatca.Domain.Entities;

namespace NexusPOS.Zatca.Application.Common;

public sealed record ZatcaInvoiceResponse(
    Guid Id,
    Guid OrderId,
    string InvoiceNumber,
    DateTime InvoiceDate,
    string SellerName,
    string SellerVatNumber,
    decimal SubtotalAmount,
    decimal TaxAmount,
    decimal TotalAmount,
    string Currency,
    string QrCodeBase64,
    string XmlContent,
    ZatcaPhase Phase,
    DateTime CreatedAt);
