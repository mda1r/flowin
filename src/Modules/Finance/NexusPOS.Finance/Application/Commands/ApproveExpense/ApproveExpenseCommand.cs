using NexusPOS.Finance.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Commands.ApproveExpense;

public sealed record ApproveExpenseCommand(Guid ExpenseId, Guid BranchId, Guid ApprovedBy) : ICommand<ExpenseResponse>;
