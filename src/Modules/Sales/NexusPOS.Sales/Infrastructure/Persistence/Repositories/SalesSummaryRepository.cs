using Microsoft.EntityFrameworkCore;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.Repositories;

namespace NexusPOS.Sales.Infrastructure.Persistence.Repositories;

internal sealed class SalesSummaryRepository(SalesDbContext dbContext) : ISalesSummaryRepository
{
    public async Task<SalesSummary?> FindByBranchAndDateAsync(
        Guid branchId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.SalesSummaries
            .FirstOrDefaultAsync(s => s.BranchId == branchId && s.SummaryDate == date, cancellationToken);
    }

    public async Task<IReadOnlyList<SalesSummary>> FindByBranchAndRangeAsync(
        Guid branchId,
        DateOnly dateFrom,
        DateOnly dateTo,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.SalesSummaries
            .Where(s => s.BranchId == branchId && s.SummaryDate >= dateFrom && s.SummaryDate <= dateTo)
            .OrderBy(s => s.SummaryDate)
            .ToListAsync(cancellationToken);
    }

    public void Add(SalesSummary summary) => dbContext.SalesSummaries.Add(summary);

    public void Update(SalesSummary summary) => dbContext.SalesSummaries.Update(summary);
}
