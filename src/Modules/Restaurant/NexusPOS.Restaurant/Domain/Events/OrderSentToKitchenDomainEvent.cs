using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.Domain.Events;

public sealed record OrderSentToKitchenDomainEvent(
    Guid OrderId,
    Guid TenantId,
    Guid BranchId,
    int TableNumber) : DomainEvent;
