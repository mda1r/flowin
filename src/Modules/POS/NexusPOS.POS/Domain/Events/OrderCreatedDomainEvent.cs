using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Domain.Events;

public sealed record OrderCreatedDomainEvent(
    Guid OrderId,
    Guid TenantId,
    Guid BranchId) : DomainEvent;
