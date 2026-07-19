using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Commands.CreateExpense;

public sealed record CreateExpenseCommand(
    Guid TenantId,
    Guid BranchId,
    ExpenseCategory Category,
    decimal Amount,
    string Currency,
    string Description,
    DateOnly ExpenseDate,
    string? Notes = null) : ICommand<ExpenseResponse>;
