using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Inventory.Domain.Events;

public sealed record LowStockAlertDomainEvent(
    Guid StockItemId,
    Guid VariantId,
    Guid BranchId,
    decimal CurrentQuantity,
    decimal ReorderPoint) : DomainEvent;
