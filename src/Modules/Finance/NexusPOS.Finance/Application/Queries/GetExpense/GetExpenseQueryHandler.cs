using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.Finance.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Queries.GetExpense;

internal sealed class GetExpenseQueryHandler(IExpenseRepository expenseRepository)
    : IQueryHandler<GetExpenseQuery, ExpenseResponse>
{
    public async Task<ErrorOr<ExpenseResponse>> Handle(
        GetExpenseQuery request,
        CancellationToken cancellationToken)
    {
        Expense? expense = await expenseRepository.FindByIdAsync(
            new ExpenseId(request.ExpenseId), cancellationToken);

        if (expense is null || expense.BranchId != request.BranchId)
        {
            return FinanceErrors.ExpenseNotFound;
        }

        return FinanceMapper.ToResponse(expense);
    }
}
