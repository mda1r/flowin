using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Domain.Events;

public sealed record OrderCancelledDomainEvent(
    Guid OrderId,
    Guid TenantId,
    Guid BranchId,
    string? Reason) : DomainEvent;
