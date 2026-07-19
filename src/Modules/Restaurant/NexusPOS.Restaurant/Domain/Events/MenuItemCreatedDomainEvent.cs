using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.Domain.Events;

public sealed record MenuItemCreatedDomainEvent(
    Guid MenuItemId,
    Guid TenantId,
    Guid BranchId,
    string Name,
    decimal Price) : DomainEvent;
