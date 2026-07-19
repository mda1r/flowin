using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.Finance.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Finance.Infrastructure.Persistence;

namespace NexusPOS.Finance.Application.Commands.VoidExpense;

internal sealed class VoidExpenseCommandHandler(
    IExpenseRepository expenseRepository,
    FinanceDbContext dbContext)
    : ICommandHandler<VoidExpenseCommand, ExpenseResponse>
{
    public async Task<ErrorOr<ExpenseResponse>> Handle(
        VoidExpenseCommand request,
        CancellationToken cancellationToken)
    {
        Expense? expense = await expenseRepository.FindByIdAsync(
            new ExpenseId(request.ExpenseId), cancellationToken);

        if (expense is null || expense.BranchId != request.BranchId)
        {
            return FinanceErrors.ExpenseNotFound;
        }

        ErrorOr<Success> result = expense.Void(request.Reason);
        if (result.IsError)
        {
            return result.Errors;
        }

        expenseRepository.Update(expense);
        await dbContext.SaveChangesAsync(cancellationToken);

        return FinanceMapper.ToResponse(expense);
    }
}
