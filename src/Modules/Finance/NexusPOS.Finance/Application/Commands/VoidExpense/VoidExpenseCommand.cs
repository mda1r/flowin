using NexusPOS.Finance.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Commands.VoidExpense;

public sealed record VoidExpenseCommand(Guid ExpenseId, Guid BranchId, string? Reason = null) : ICommand<ExpenseResponse>;
