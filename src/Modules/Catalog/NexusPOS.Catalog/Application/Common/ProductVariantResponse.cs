namespace NexusPOS.Catalog.Application.Common;

public sealed record ProductVariantResponse(
    Guid Id,
    string Sku,
    string Name,
    decimal CostPrice,
    decimal SalePrice,
    string Currency,
    string? Barcode,
    bool IsActive,
    DateTime? ExpiryDate = null);
