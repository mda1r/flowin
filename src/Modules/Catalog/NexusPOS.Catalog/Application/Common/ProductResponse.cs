using NexusPOS.Catalog.Domain.Enums;

namespace NexusPOS.Catalog.Application.Common;

public sealed record ProductResponse(
    Guid Id,
    string Name,
    string? Description,
    Guid? CategoryId,
    ProductType Type,
    TaxClass TaxClass,
    bool IsActive,
    bool TrackInventory,
    string? ImageUrl,
    DateTime CreatedAt,
    IReadOnlyList<ProductVariantResponse> Variants);
