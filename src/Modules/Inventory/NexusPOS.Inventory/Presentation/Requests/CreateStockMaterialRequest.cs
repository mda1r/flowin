using NexusPOS.Inventory.Domain.Enums;

namespace NexusPOS.Inventory.Presentation.Requests;

public sealed record CreateStockMaterialRequest(
    string Code,
    string NameAr,
    string? NameEn,
    Guid? CategoryId,
    string StorageUnit,
    string ComponentUnit,
    decimal ConversionFactor,
    CostMethod CostMethod,
    decimal InitialCost = 0m,
    decimal? MinLevel = null,
    decimal? MaxLevel = null,
    decimal? ReorderLevel = null);

public sealed record UpdateStockMaterialRequest(
    string Code,
    string NameAr,
    string? NameEn,
    Guid? CategoryId,
    string StorageUnit,
    string ComponentUnit,
    decimal ConversionFactor,
    CostMethod CostMethod,
    decimal? ManualCost = null,
    decimal? MinLevel = null,
    decimal? MaxLevel = null,
    decimal? ReorderLevel = null);
