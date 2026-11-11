using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.Finance.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Finance.Application.Commands.CreateExpense;

internal sealed class CreateExpenseCommandHandler(
    IExpenseRepository expenseRepository,
    FinanceDbContext dbContext,
    ITenantContext tenantContext)
    : ICommandHandler<CreateExpenseCommand, ExpenseResponse>
{
    // Expenses are booked in the shop's currency; the client does not choose one.
    internal const string TenantCurrency = "SAR";

    public async Task<ErrorOr<ExpenseResponse>> Handle(
        CreateExpenseCommand request,
        CancellationToken cancellationToken)
    {
        // The tenant always comes from the signed-in user's token, never from the request body.
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return FinanceErrors.NoTenant;
        }

        // An instant approval is recorded against whoever is signed in, so it needs a user.
        Guid? approverId = null;
        if (request.ApproveNow)
        {
            if (tenantContext.UserId is not Guid userId)
            {
                return FinanceErrors.NoUser;
            }

            approverId = userId;
        }

        ErrorOr<Expense> expense = Expense.Create(
            tenantId, request.BranchId, request.Category,
            request.Amount, TenantCurrency, request.Description,
            request.ExpenseDate, request.Notes);

        if (expense.IsError)
        {
            return expense.Errors;
        }

        if (approverId is Guid approver)
        {
            ErrorOr<Success> approved = expense.Value.Approve(approver);
            if (approved.IsError)
            {
                return approved.Errors;
            }
        }

        expenseRepository.Add(expense.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return FinanceMapper.ToResponse(expense.Value);
    }
}
