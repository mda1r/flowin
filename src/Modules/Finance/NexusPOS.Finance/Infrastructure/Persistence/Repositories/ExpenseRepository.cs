using Microsoft.EntityFrameworkCore;
using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.Finance.Domain.Repositories;
using NexusPOS.Finance.Domain.ValueObjects;

namespace NexusPOS.Finance.Infrastructure.Persistence.Repositories;

internal sealed class ExpenseRepository(FinanceDbContext dbContext) : IExpenseRepository
{
    public async Task<Expense?> FindByIdAsync(ExpenseId id, CancellationToken cancellationToken = default)
        => await dbContext.Expenses
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Expense>> FindByBranchAsync(
        Guid branchId,
        ExpenseCategory? category,
        ExpenseStatus? status,
        DateOnly? dateFrom,
        DateOnly? dateTo,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        IQueryable<Expense> query = dbContext.Expenses.Where(e => e.BranchId == branchId);

        if (category.HasValue)
        {
            query = query.Where(e => e.Category == category.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(e => e.Status == status.Value);
        }

        if (dateFrom.HasValue)
        {
            query = query.Where(e => e.ExpenseDate >= dateFrom.Value);
        }

        if (dateTo.HasValue)
        {
            query = query.Where(e => e.ExpenseDate <= dateTo.Value);
        }

        return await query
            .OrderByDescending(e => e.ExpenseDate)
            .ThenByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public void Add(Expense expense) => dbContext.Expenses.Add(expense);

    public void Update(Expense expense) => dbContext.Expenses.Update(expense);
}
