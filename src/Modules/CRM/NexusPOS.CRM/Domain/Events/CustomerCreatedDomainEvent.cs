using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.CRM.Domain.Events;

public sealed record CustomerCreatedDomainEvent(Guid CustomerId, Guid TenantId, string Name) : DomainEvent;
