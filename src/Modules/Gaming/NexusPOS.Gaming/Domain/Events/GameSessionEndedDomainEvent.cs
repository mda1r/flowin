using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Gaming.Domain.Events;

public sealed record GameSessionEndedDomainEvent(
    Guid StationId, Guid TenantId, Guid BranchId) : DomainEvent;
