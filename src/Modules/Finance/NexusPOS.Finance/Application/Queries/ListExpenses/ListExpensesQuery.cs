using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Queries.ListExpenses;

public sealed record ListExpensesQuery(
    Guid BranchId,
    ExpenseCategory? Category = null,
    ExpenseStatus? Status = null,
    DateOnly? DateFrom = null,
    DateOnly? DateTo = null,
    int Page = 1,
    int PageSize = 20) : IQuery<IReadOnlyList<ExpenseResponse>>;
