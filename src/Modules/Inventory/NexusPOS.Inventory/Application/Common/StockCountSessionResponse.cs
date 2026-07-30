namespace NexusPOS.Inventory.Application.Common;

public sealed record StockCountItemResponse(
    Guid Id,
    Guid StockItemId,
    Guid VariantId,
    decimal SystemQuantity,
    decimal? CountedQuantity,
    decimal Difference,
    decimal UnitCost,
    decimal SystemValue,
    decimal CountedValue,
    decimal TaxAmount,
    bool HasDiscrepancy);

public sealed record StockCountSessionResponse(
    Guid Id,
    Guid BranchId,
    string Type,
    string Status,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    string? Notes,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    int TotalItems,
    int CountedItems,
    int DiscrepancyCount,
    decimal TotalSystemValue,
    decimal TotalCountedValue,
    decimal TotalTaxAmount,
    IReadOnlyList<StockCountItemResponse> Items);
