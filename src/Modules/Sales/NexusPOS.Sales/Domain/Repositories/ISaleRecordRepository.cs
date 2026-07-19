using NexusPOS.Sales.Domain.Entities;

namespace NexusPOS.Sales.Domain.Repositories;

public interface ISaleRecordRepository
{
    Task<IReadOnlyList<SaleRecord>> FindByBranchAsync(Guid branchId, DateTime dateFrom, DateTime dateTo, int page, int pageSize, CancellationToken cancellationToken = default);
    void Add(SaleRecord record);
}
