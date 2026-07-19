using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Organization.Domain.Events;

public sealed record BranchDeactivatedDomainEvent(
    Guid BranchId,
    Guid TenantId) : IDomainEvent
{
    public Guid EventId { get; } = Guid.NewGuid();
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}
