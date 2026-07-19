using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Finance.Domain.Events;

public sealed record ExpenseCreatedDomainEvent(
    Guid ExpenseId, Guid TenantId, Guid BranchId, decimal Amount, string Currency) : DomainEvent;
