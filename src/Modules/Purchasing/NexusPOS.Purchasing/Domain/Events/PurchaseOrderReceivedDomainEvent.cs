using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Purchasing.Domain.Events;

public sealed record PurchaseOrderReceivedDomainEvent(
    Guid PurchaseOrderId,
    Guid TenantId,
    Guid BranchId,
    IReadOnlyList<(Guid VariantId, decimal Quantity)> ReceivedItems) : DomainEvent;
