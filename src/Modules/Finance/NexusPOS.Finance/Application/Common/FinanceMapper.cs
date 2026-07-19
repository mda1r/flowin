using NexusPOS.Finance.Domain.Entities;

namespace NexusPOS.Finance.Application.Common;

internal static class FinanceMapper
{
    internal static ExpenseResponse ToResponse(Expense expense) => new(
        expense.Id.Value,
        expense.TenantId,
        expense.BranchId,
        expense.Category,
        expense.Amount,
        expense.Currency,
        expense.Description,
        expense.ExpenseDate,
        expense.Status,
        expense.ApprovedBy,
        expense.VoidReason,
        expense.Notes,
        expense.CreatedAt);
}
