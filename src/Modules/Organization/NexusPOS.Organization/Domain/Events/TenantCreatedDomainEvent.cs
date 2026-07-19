using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Organization.Domain.Events;

public sealed record TenantCreatedDomainEvent(
    Guid TenantId,
    string Name,
    string Subdomain) : IDomainEvent
{
    public Guid EventId { get; } = Guid.NewGuid();
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}
