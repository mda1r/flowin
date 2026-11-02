using NexusPOS.Catalog.Domain.Enums;

namespace NexusPOS.Catalog.Application.Common;

// ModifierGroups is filled by the list, by-id and barcode reads (the till's one query); writes leave it null.
public sealed record ProductResponse(
    Guid Id,
    string Name,
    string? Description,
    Guid? CategoryId,
    ProductType Type,
    TaxClass TaxClass,
    bool IsActive,
    bool TrackInventory,
    UnitType UnitType,
    string? ImageUrl,
    DateTime CreatedAt,
    IReadOnlyList<ProductVariantResponse> Variants,
    IReadOnlyList<ProductModifierGroupResponse>? ModifierGroups = null,
    string? NameEn = null);
