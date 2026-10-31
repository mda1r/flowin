using ErrorOr;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Queries.GetExpenseSummary;

internal sealed class GetExpenseSummaryQueryHandler(IExpenseRepository expenseRepository)
    : IQueryHandler<GetExpenseSummaryQuery, ExpenseSummaryResponse>
{
    public async Task<ErrorOr<ExpenseSummaryResponse>> Handle(
        GetExpenseSummaryQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ExpenseTotal> totals = await expenseRepository.SumByCategoryAndStatusAsync(
            request.BranchId, request.DateFrom, request.DateTo, cancellationToken);

        return Build(request.DateFrom, request.DateTo, totals);
    }

    // Spending by category counts approved expenses only: pending ones may still be voided.
    internal static ExpenseSummaryResponse Build(DateOnly dateFrom, DateOnly dateTo, IReadOnlyList<ExpenseTotal> totals)
    {
        ExpenseStatusTotalResponse ForStatus(ExpenseStatus status)
        {
            List<ExpenseTotal> rows = [.. totals.Where(t => t.Status == status)];
            return new(status, rows.Sum(t => t.Count), rows.Sum(t => t.Total));
        }

        List<ExpenseCategoryTotalResponse> byCategory = [.. totals
            .Where(t => t.Status == ExpenseStatus.Approved)
            .GroupBy(t => t.Category)
            .Select(g => new ExpenseCategoryTotalResponse(g.Key, g.Sum(t => t.Count), g.Sum(t => t.Total)))
            .OrderByDescending(c => c.Total)
            .ThenBy(c => c.Category)];

        List<ExpenseGroupResponse> groups = [.. totals
            .OrderBy(t => t.Category)
            .ThenBy(t => t.Status)
            .Select(t => new ExpenseGroupResponse(t.Category, t.Status, t.Count, t.Total))];

        return new ExpenseSummaryResponse(
            dateFrom,
            dateTo,
            ForStatus(ExpenseStatus.Approved),
            ForStatus(ExpenseStatus.Pending),
            ForStatus(ExpenseStatus.Voided),
            byCategory,
            groups);
    }
}
