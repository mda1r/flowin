using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Purchasing.Domain.Events;

public sealed record PurchaseOrderCancelledDomainEvent(
    Guid PurchaseOrderId,
    Guid TenantId,
    Guid BranchId,
    string? Reason) : DomainEvent;
