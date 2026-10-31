using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.Services;
using NexusPOS.Inventory.Domain.ValueObjects;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Repositories;

internal sealed class StockItemRepository(InventoryDbContext dbContext) : IStockItemRepository
{
    public async Task<StockItem?> FindByIdAsync(StockItemId id, CancellationToken cancellationToken = default) =>
        await dbContext.StockItems
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public async Task<StockItem?> FindByVariantAndBranchAsync(
        Guid variantId, Guid branchId, CancellationToken cancellationToken = default) =>
        await dbContext.StockItems
            .FirstOrDefaultAsync(
                s => s.VariantId == variantId && s.BranchId == branchId,
                cancellationToken);

    public async Task<IReadOnlyList<StockItem>> FindByBranchAsync(
        Guid branchId, bool includeArchived = false, CancellationToken cancellationToken = default) =>
        await dbContext.StockItems
            .Where(s => s.BranchId == branchId && (includeArchived || !s.IsArchived))
            .OrderBy(s => s.VariantId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<StockItem>> FindLowStockAsync(
        Guid branchId, CancellationToken cancellationToken = default) =>
        await dbContext.StockItems
            .Where(s => s.BranchId == branchId && !s.IsArchived && s.ReorderPoint > 0 && s.Quantity <= s.ReorderPoint)
            .OrderBy(s => s.Quantity)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<StockItem>> FindExpiringAsync(
        Guid branchId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        List<StockItem> allWithExpiry = await dbContext.StockItems
            .Where(s => s.BranchId == branchId && !s.IsArchived && s.ExpiryDate != null && s.Quantity > 0)
            .OrderBy(s => s.ExpiryDate)
            .ToListAsync(cancellationToken);

        return [.. allWithExpiry
            .Where(s => StoreCalendar.DaysUntilExpiry(s.ExpiryDate!.Value, now) <= s.NotifyDaysBeforeExpiry)];
    }

    public Task<bool> HasMovementsAsync(StockItemId id, CancellationToken cancellationToken = default) =>
        dbContext.StockMovements.AnyAsync(m => m.StockItemId == id, cancellationToken);

    public async Task<(IReadOnlyList<StockMovement> Items, int TotalCount)> FindMovementsAsync(
        StockItemId id,
        MovementType? type,
        DateTime? fromUtc,
        DateTime? toUtc,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        IQueryable<StockMovement> query = dbContext.StockMovements.AsNoTracking().Where(m => m.StockItemId == id);
        if (type.HasValue)
        {
            query = query.Where(m => m.Type == type.Value);
        }
        if (fromUtc.HasValue)
        {
            query = query.Where(m => m.OccurredAt >= fromUtc.Value);
        }
        if (toUtc.HasValue)
        {
            query = query.Where(m => m.OccurredAt < toUtc.Value);
        }

        int total = await query.CountAsync(cancellationToken);
        List<StockMovement> items = await query
            .OrderByDescending(m => m.OccurredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }

    // Row-locks the items until the caller's transaction ends, so a sale cannot change them
    // between this read and the caller's save. Ordered by id so concurrent lockers never deadlock.
    public async Task<IReadOnlyList<StockItem>> LockForUpdateAsync(
        IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default)
    {
        Guid[] idArray = [.. ids];
        return await dbContext.StockItems
            .FromSql($"SELECT * FROM stock_items WHERE id = ANY({idArray}) ORDER BY id FOR UPDATE")
            .ToListAsync(cancellationToken);
    }

    public void Add(StockItem stockItem) => dbContext.StockItems.Add(stockItem);

    public void Update(StockItem stockItem) => dbContext.StockItems.Update(stockItem);

    public void Remove(StockItem stockItem) => dbContext.StockItems.Remove(stockItem);
}
