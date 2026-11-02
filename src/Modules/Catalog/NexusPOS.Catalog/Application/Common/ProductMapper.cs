using NexusPOS.Catalog.Domain.Entities;

namespace NexusPOS.Catalog.Application.Common;

internal static class ProductMapper
{
    public static ProductResponse ToResponse(Product p, IReadOnlyList<ProductModifierGroupResponse>? modifierGroups = null) => new(
        p.Id.Value,
        p.Name,
        p.Description,
        p.CategoryId?.Value,
        p.Type,
        p.TaxClass,
        p.IsActive,
        p.TrackInventory,
        p.UnitType,
        p.ImageUrl,
        p.CreatedAt,
        [.. p.Variants.Select(ToResponse)],
        modifierGroups,
        p.NameEn);

    public static ProductVariantResponse ToResponse(ProductVariant v) => new(
        v.Id.Value, v.Sku.Value, v.Name,
        v.CostPrice.Amount, v.SalePrice.Amount, v.SalePrice.Currency,
        v.Barcode, v.IsActive, v.ExpiryDate, v.NameEn);
}
