using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Catalog.Domain.Events;

public sealed record CategoryCreatedDomainEvent(
    Guid CategoryId,
    string Name) : DomainEvent;
