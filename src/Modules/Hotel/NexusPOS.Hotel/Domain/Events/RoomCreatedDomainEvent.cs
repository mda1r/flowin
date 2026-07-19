using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Hotel.Domain.Events;

public sealed record RoomCreatedDomainEvent(
    Guid RoomId, Guid TenantId, Guid BranchId, string RoomNumber, decimal NightlyRate) : DomainEvent;
