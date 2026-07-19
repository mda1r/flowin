using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.Domain.Events;

public sealed record RestaurantOrderCreatedDomainEvent(
    Guid OrderId,
    Guid TenantId,
    Guid BranchId,
    int TableNumber) : DomainEvent;
