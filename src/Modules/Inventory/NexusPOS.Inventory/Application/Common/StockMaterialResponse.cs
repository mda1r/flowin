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
    bool IsLowStock,
    decimal CostPerComponentUnit);

public sealed record StockMaterialMovementResponse(
    Guid Id,
    string Type,
    decimal QuantityChange,
    decimal? UnitCost,
    decimal QuantityAfter,
    decimal CostAfter,
    string? Note,
    Guid? UserId,
    DateTime CreatedAt);
