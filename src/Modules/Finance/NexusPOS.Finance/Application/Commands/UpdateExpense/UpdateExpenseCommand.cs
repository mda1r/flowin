using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Commands.UpdateExpense;

/// <summary>Corrects an expense that is still waiting for approval.</summary>
public sealed record UpdateExpenseCommand(
    Guid ExpenseId,
    Guid BranchId,
    ExpenseCategory Category,
    decimal Amount,
    string Description,
    DateOnly ExpenseDate,
    string? Notes = null) : ICommand<ExpenseResponse>;
