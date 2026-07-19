using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.Finance.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Finance.Infrastructure.Persistence;

namespace NexusPOS.Finance.Application.Commands.ApproveExpense;

internal sealed class ApproveExpenseCommandHandler(
    IExpenseRepository expenseRepository,
    FinanceDbContext dbContext)
    : ICommandHandler<ApproveExpenseCommand, ExpenseResponse>
{
    public async Task<ErrorOr<ExpenseResponse>> Handle(
        ApproveExpenseCommand request,
        CancellationToken cancellationToken)
    {
        Expense? expense = await expenseRepository.FindByIdAsync(
            new ExpenseId(request.ExpenseId), cancellationToken);

        if (expense is null || expense.BranchId != request.BranchId)
        {
            return FinanceErrors.ExpenseNotFound;
        }

        ErrorOr<Success> result = expense.Approve(request.ApprovedBy);
        if (result.IsError)
        {
            return result.Errors;
        }

        expenseRepository.Update(expense);
        await dbContext.SaveChangesAsync(cancellationToken);

        return FinanceMapper.ToResponse(expense);
    }
}
