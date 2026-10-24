namespace NexusPOS.SharedKernel.Domain.Events;

// Cross-module contract: Purchasing raises it when a purchase order's product lines are received;
// Inventory adds the stock and Catalog updates each product's cost.
public sealed record PurchaseOrderReceivedDomainEvent(
    Guid PurchaseOrderId,
    Guid TenantId,
    Guid BranchId,
    DateTime ReceivedAt,
    IReadOnlyList<PurchaseOrderReceivedDomainEvent.Item> ReceivedItems) : DomainEvent
{
    public sealed record Item(Guid VariantId, decimal Quantity, decimal UnitCost);
}
