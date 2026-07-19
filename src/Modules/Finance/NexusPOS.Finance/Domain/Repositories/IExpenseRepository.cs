using NexusPOS.Finance.Domain.Entities;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.Finance.Domain.ValueObjects;

namespace NexusPOS.Finance.Domain.Repositories;

public interface IExpenseRepository
{
    Task<Expense?> FindByIdAsync(ExpenseId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Expense>> FindByBranchAsync(Guid branchId, ExpenseCategory? category, ExpenseStatus? status, DateOnly? dateFrom, DateOnly? dateTo, int page, int pageSize, CancellationToken cancellationToken = default);
    void Add(Expense expense);
    void Update(Expense expense);
}
