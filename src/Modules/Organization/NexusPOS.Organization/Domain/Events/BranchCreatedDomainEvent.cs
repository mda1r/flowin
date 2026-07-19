using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Organization.Domain.Events;

public sealed record BranchCreatedDomainEvent(
    Guid BranchId,
    Guid TenantId,
    string Name) : IDomainEvent
{
    public Guid EventId { get; } = Guid.NewGuid();
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}
