using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.ValueObjects;

namespace NexusPOS.Inventory.Domain.Repositories;

public interface IStockItemRepository
{
    Task<StockItem?> FindByIdAsync(StockItemId id, CancellationToken cancellationToken = default);
    Task<StockItem?> FindByVariantAndBranchAsync(Guid variantId, Guid branchId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockItem>> FindByBranchAsync(Guid branchId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockItem>> FindLowStockAsync(Guid branchId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockItem>> FindExpiringAsync(Guid branchId, int daysAhead, CancellationToken cancellationToken = default);
    void Add(StockItem stockItem);
    void Update(StockItem stockItem);
}
