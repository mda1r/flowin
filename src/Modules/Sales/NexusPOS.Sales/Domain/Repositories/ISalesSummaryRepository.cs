using NexusPOS.Sales.Domain.Entities;

namespace NexusPOS.Sales.Domain.Repositories;

public interface ISalesSummaryRepository
{
    Task<SalesSummary?> FindByBranchAndDateAsync(Guid branchId, DateOnly summaryDate, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SalesSummary>> FindByBranchAndRangeAsync(Guid branchId, DateOnly dateFrom, DateOnly dateTo, CancellationToken cancellationToken = default);
    void Add(SalesSummary summary);
    void Update(SalesSummary summary);
}
