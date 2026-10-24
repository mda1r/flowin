namespace NexusPOS.SharedKernel.Domain.Events;

// Cross-module contract: Purchasing raises it when a purchase order with raw-material lines
// is received; Inventory consumes it. Lives here so neither module references the other.
public sealed record StockMaterialsPurchasedDomainEvent(
    Guid TenantId,
    Guid PurchaseOrderId,
    IReadOnlyList<StockMaterialsPurchasedDomainEvent.Line> Lines) : DomainEvent
{
    public sealed record Line(Guid MaterialId, decimal Quantity, decimal UnitCost);
}
