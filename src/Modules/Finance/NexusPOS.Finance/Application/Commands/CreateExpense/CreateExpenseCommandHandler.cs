using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.Finance.Domain;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Finance.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Finance.Application.Commands.CreateExpense;

internal sealed class CreateExpenseCommandHandler(
    IExpenseRepository expenseRepository,
    FinanceDbContext dbContext,
    ITenantContext tenantContext)
    : ICommandHandler<CreateExpenseCommand, ExpenseResponse>
{
    public async Task<ErrorOr<ExpenseResponse>> Handle(
        CreateExpenseCommand request,
        CancellationToken cancellationToken)
    {
        // The tenant always comes from the signed-in user's token, never from the request body.
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return FinanceErrors.NoTenant;
        }

        ErrorOr<Expense> expense = Expense.Create(
            tenantId, request.BranchId, request.Category,
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
