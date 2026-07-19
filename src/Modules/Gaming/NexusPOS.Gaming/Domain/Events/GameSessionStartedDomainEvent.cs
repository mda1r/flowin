using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Gaming.Domain.Events;

public sealed record GameSessionStartedDomainEvent(
    Guid StationId, Guid TenantId, Guid BranchId) : DomainEvent;
