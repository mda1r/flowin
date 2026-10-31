using NexusPOS.Inventory.Domain.Entities;

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
    int NotifyDaysBeforeExpiry = 7,
    bool IsArchived = false)
{
    public static StockItemResponse From(StockItem s) => new(
        s.Id.Value, s.VariantId, s.BranchId,
        s.Quantity, s.ReorderPoint, s.ReorderQuantity,
        s.Quantity <= s.ReorderPoint && s.ReorderPoint > 0,
        s.UpdatedAt, s.ExpiryDate, s.NotifyDaysBeforeExpiry, s.IsArchived);
}
