using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Finance.Infrastructure.Persistence;

namespace NexusPOS.Finance.Application.Commands.CreateExpense;

internal sealed class CreateExpenseCommandHandler(
    IExpenseRepository expenseRepository,
    FinanceDbContext dbContext)
    : ICommandHandler<CreateExpenseCommand, ExpenseResponse>
{
    public async Task<ErrorOr<ExpenseResponse>> Handle(
        CreateExpenseCommand request,
        CancellationToken cancellationToken)
    {
        ErrorOr<Expense> expense = Expense.Create(
            request.TenantId, request.BranchId, request.Category,
            request.Amount, request.Currency, request.Description,
            request.ExpenseDate, request.Notes);

        if (expense.IsError)
        {
            return expense.Errors;
        }

        expenseRepository.Add(expense.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return FinanceMapper.ToResponse(expense.Value);
    }
}
