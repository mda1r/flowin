using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Catalog.Domain.Events;

public sealed record VariantAddedDomainEvent(
    Guid ProductId,
    Guid VariantId,
    string Sku) : DomainEvent;
