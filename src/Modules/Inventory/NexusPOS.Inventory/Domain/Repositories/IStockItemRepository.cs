using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.ValueObjects;

namespace NexusPOS.Inventory.Domain.Repositories;

public interface IStockItemRepository
{
    Task<StockItem?> FindByIdAsync(StockItemId id, CancellationToken cancellationToken = default);
    Task<StockItem?> FindByVariantAndBranchAsync(Guid variantId, Guid branchId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockItem>> FindByBranchAsync(Guid branchId, bool includeArchived = false, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockItem>> FindLowStockAsync(Guid branchId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockItem>> FindExpiringAsync(Guid branchId, CancellationToken cancellationToken = default);
    Task<bool> HasMovementsAsync(StockItemId id, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<StockMovement> Items, int TotalCount)> FindMovementsAsync(
        StockItemId id,
        MovementType? type,
        DateTime? fromUtc,
        DateTime? toUtc,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockItem>> LockForUpdateAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default);
    void Add(StockItem stockItem);
    void Update(StockItem stockItem);
    void Remove(StockItem stockItem);
}
