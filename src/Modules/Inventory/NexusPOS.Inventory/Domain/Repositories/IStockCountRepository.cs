using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.ValueObjects;

namespace NexusPOS.Inventory.Domain.Repositories;

public interface IStockCountRepository
{
    Task<StockCountSession?> FindByIdAsync(StockCountSessionId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockCountSession>> FindByBranchAsync(Guid branchId, CancellationToken cancellationToken = default);
    void Add(StockCountSession session);
    void Update(StockCountSession session);
}
