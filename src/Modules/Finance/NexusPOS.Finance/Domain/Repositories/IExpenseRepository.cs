using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.Finance.Domain.ValueObjects;

namespace NexusPOS.Finance.Domain.Repositories;

public interface IExpenseRepository
{
    Task<Expense?> FindByIdAsync(ExpenseId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Expense>> FindByBranchAsync(Guid branchId, ExpenseCategory? category, ExpenseStatus? status, DateOnly? dateFrom, DateOnly? dateTo, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExpenseTotal>> SumByCategoryAndStatusAsync(Guid branchId, DateOnly dateFrom, DateOnly dateTo, CancellationToken cancellationToken = default);
    void Add(Expense expense);
    void Update(Expense expense);
}

/// <summary>Count and amount of a branch's expenses for one category and status within a date range.</summary>
public sealed record ExpenseTotal(ExpenseCategory Category, ExpenseStatus Status, int Count, decimal Total);
