using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.Finance.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Finance.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Finance.Application.Commands.ApproveExpense;

internal sealed class ApproveExpenseCommandHandler(
    IExpenseRepository expenseRepository,
    FinanceDbContext dbContext,
    ITenantContext tenantContext)
    : ICommandHandler<ApproveExpenseCommand, ExpenseResponse>
{
    public async Task<ErrorOr<ExpenseResponse>> Handle(
        ApproveExpenseCommand request,
        CancellationToken cancellationToken)
    {
        // The approver is whoever is signed in; a body field would let anyone approve in someone else's name.
        if (tenantContext.UserId is not Guid approverId)
        {
            return FinanceErrors.NoUser;
        }

        Expense? expense = await expenseRepository.FindByIdAsync(
            new ExpenseId(request.ExpenseId), cancellationToken);

        if (expense is null || expense.BranchId != request.BranchId)
        {
            return FinanceErrors.ExpenseNotFound;
        }

        ErrorOr<Success> result = expense.Approve(approverId);
        if (result.IsError)
        {
            return result.Errors;
        }

        expenseRepository.Update(expense);
        await dbContext.SaveChangesAsync(cancellationToken);

        return FinanceMapper.ToResponse(expense);
    }
}
