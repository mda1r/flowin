using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Inventory.Domain.Events;

public sealed record StockLevelChangedDomainEvent(
    Guid StockItemId,
    Guid VariantId,
    Guid BranchId,
    decimal OldQuantity,
    decimal NewQuantity) : DomainEvent;
