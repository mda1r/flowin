namespace NexusPOS.Catalog.Presentation.Requests;

public sealed record AddVariantRequest(
    string Sku,
    string Name,
    decimal CostPrice,
    decimal SalePrice,
    string Currency,
    string? Barcode = null,
    DateTime? ExpiryDate = null);
