using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Queries.ListExpenses;

internal sealed class ListExpensesQueryHandler(IExpenseRepository expenseRepository)
    : IQueryHandler<ListExpensesQuery, IReadOnlyList<ExpenseResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ExpenseResponse>>> Handle(
        ListExpensesQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Domain.Entities.Expense> expenses = await expenseRepository.FindByBranchAsync(
            request.BranchId, request.Category, request.Status,
            request.DateFrom, request.DateTo, request.Page, request.PageSize, cancellationToken);

        return expenses.Select(FinanceMapper.ToResponse).ToList();
    }
}
