using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.IAM.Domain.Events;

public sealed record UserRegisteredDomainEvent(
    Guid UserId,
    string Email) : IDomainEvent
{
    public Guid EventId { get; } = Guid.NewGuid();
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}
