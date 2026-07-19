using MediatR;

namespace NexusPOS.SharedKernel.Domain.Events;

public interface IDomainEvent : INotification
{
    Guid EventId { get; }
    DateTime OccurredAt { get; }
}
