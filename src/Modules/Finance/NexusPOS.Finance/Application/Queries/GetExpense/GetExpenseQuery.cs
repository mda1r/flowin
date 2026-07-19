using NexusPOS.Finance.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Queries.GetExpense;

public sealed record GetExpenseQuery(Guid ExpenseId, Guid BranchId) : IQuery<ExpenseResponse>;
