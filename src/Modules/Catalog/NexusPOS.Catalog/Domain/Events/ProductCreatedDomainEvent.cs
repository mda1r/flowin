using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Catalog.Domain.Events;

public sealed record ProductCreatedDomainEvent(
    Guid ProductId,
    string Name,
    string Sku) : DomainEvent;
