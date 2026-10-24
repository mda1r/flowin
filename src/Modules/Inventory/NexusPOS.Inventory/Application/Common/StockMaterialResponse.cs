namespace NexusPOS.Inventory.Application.Common;

public sealed record StockMaterialResponse(
    Guid Id,
    string Code,
    string NameAr,
    string? NameEn,
    Guid? CategoryId,
    string? CategoryName,
    string StorageUnit,
    string ComponentUnit,
    decimal ConversionFactor,
    string CostMethod,
    decimal CurrentCost,
    decimal CurrentQuantityInStorageUnits,
    decimal? MinLevel,
    decimal? MaxLevel,
    decimal? ReorderLevel,
    bool IsActive,
    bool IsLowStock);
