using Microsoft.EntityFrameworkCore;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.Repositories;

namespace NexusPOS.Sales.Infrastructure.Persistence.Repositories;

internal sealed class SaleRecordRepository(SalesDbContext dbContext) : ISaleRecordRepository
{
    public async Task<IReadOnlyList<SaleRecord>> FindByBranchAsync(
        Guid branchId,
        DateTime dateFrom,
        DateTime dateTo,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.SaleRecords
            .Where(r => r.BranchId == branchId
                && r.CompletedAt >= dateFrom
                && r.CompletedAt <= dateTo)
            .OrderByDescending(r => r.CompletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public void Add(SaleRecord record) => dbContext.SaleRecords.Add(record);
}
