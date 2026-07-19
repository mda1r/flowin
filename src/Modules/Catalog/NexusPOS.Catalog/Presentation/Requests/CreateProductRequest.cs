using NexusPOS.Catalog.Domain.Enums;

namespace NexusPOS.Catalog.Presentation.Requests;

public sealed record CreateProductRequest(
    string Name,
    string? Description,
    Guid? CategoryId,
    ProductType Type,
    TaxClass TaxClass,
    bool TrackInventory,
    string Sku,
    string VariantName,
    decimal CostPrice,
    decimal SalePrice,
    string Currency,
    string? Barcode = null,
    DateTime? ExpiryDate = null);
