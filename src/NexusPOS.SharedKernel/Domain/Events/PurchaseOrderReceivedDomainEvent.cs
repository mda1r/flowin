namespace NexusPOS.SharedKernel.Domain.Events;

// Cross-module contract: Purchasing raises it when a purchase order's product lines are received;
// Inventory consumes it to add stock in the order's branch.
public sealed record PurchaseOrderReceivedDomainEvent(
    Guid PurchaseOrderId,
    Guid TenantId,
    Guid BranchId,
    IReadOnlyList<(Guid VariantId, decimal Quantity)> ReceivedItems) : DomainEvent;
