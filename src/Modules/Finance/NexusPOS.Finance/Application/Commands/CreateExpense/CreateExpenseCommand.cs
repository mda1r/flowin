using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Commands.CreateExpense;

// ApproveNow books the expense as approved by the signed-in user. The controller only passes true when the
// caller may approve expenses; for everyone else the expense waits for approval.
public sealed record CreateExpenseCommand(
    Guid BranchId,
    ExpenseCategory Category,
    decimal Amount,
    string Description,
    DateOnly ExpenseDate,
    string? Notes = null,
    bool ApproveNow = false) : ICommand<ExpenseResponse>;
