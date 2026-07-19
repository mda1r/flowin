using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Catalog.Domain.Events;

public sealed record ProductDeactivatedDomainEvent(Guid ProductId) : DomainEvent;
