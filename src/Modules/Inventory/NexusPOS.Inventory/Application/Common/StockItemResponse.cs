namespace NexusPOS.Inventory.Application.Common;

public sealed record StockItemResponse(
    Guid Id,
    Guid VariantId,
    Guid BranchId,
    decimal Quantity,
    decimal ReorderPoint,
    decimal ReorderQuantity,
    bool IsLowStock,
    DateTime UpdatedAt,
    DateTime? ExpiryDate = null,
    int NotifyDaysBeforeExpiry = 7);
