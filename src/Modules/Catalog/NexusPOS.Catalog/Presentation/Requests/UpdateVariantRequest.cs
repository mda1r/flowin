namespace NexusPOS.Catalog.Presentation.Requests;

public sealed record UpdateVariantRequest(
    string Name,
    decimal CostPrice,
    decimal SalePrice,
    string Currency,
    string? Barcode = null);
