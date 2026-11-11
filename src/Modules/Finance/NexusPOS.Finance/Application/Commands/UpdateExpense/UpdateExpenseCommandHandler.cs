using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.Finance.Domain.ValueObjects;
using NexusPOS.Finance.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Finance.Application.Commands.UpdateExpense;

internal sealed class UpdateExpenseCommandHandler(
    IExpenseRepository expenseRepository,
    FinanceDbContext dbContext,
    ITenantContext tenantContext)
    : ICommandHandler<UpdateExpenseCommand, ExpenseResponse>
{
    public async Task<ErrorOr<ExpenseResponse>> Handle(
        UpdateExpenseCommand request,
        CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return FinanceErrors.NoTenant;
        }

        Expense? expense = await expenseRepository.FindByIdAsync(
            new ExpenseId(request.ExpenseId), cancellationToken);

        // Another tenant's or branch's expense looks the same as a missing one.
        if (expense is null || expense.TenantId != tenantId || expense.BranchId != request.BranchId)
        {
            return FinanceErrors.ExpenseNotFound;
        }

        // Approved and voided expenses are already in the books; only pending ones can change.
        ErrorOr<Success> result = expense.Update(
            request.Category, request.Amount, request.Description, request.ExpenseDate, request.Notes);
        if (result.IsError)
        {
            return result.Errors;
        }

        expenseRepository.Update(expense);
        await dbContext.SaveChangesAsync(cancellationToken);

        return FinanceMapper.ToResponse(expense);
    }
}
