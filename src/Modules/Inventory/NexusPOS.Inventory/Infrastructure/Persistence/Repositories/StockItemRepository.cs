using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
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
        Guid branchId, CancellationToken cancellationToken = default) =>
        await dbContext.StockItems
            .Where(s => s.BranchId == branchId)
            .OrderBy(s => s.VariantId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<StockItem>> FindLowStockAsync(
        Guid branchId, CancellationToken cancellationToken = default) =>
        await dbContext.StockItems
            .Where(s => s.BranchId == branchId && s.ReorderPoint > 0 && s.Quantity <= s.ReorderPoint)
            .OrderBy(s => s.Quantity)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<StockItem>> FindExpiringAsync(
        Guid branchId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        List<StockItem> allWithExpiry = await dbContext.StockItems
            .Where(s => s.BranchId == branchId && s.ExpiryDate != null && s.Quantity > 0)
            .OrderBy(s => s.ExpiryDate)
            .ToListAsync(cancellationToken);

        return allWithExpiry
            .Where(s => s.ExpiryDate!.Value <= now.AddDays(s.NotifyDaysBeforeExpiry))
            .ToList();
    }

    public void Add(StockItem stockItem) => dbContext.StockItems.Add(stockItem);

    public void Update(StockItem stockItem) => dbContext.StockItems.Update(stockItem);

    public void Remove(StockItem stockItem) => dbContext.StockItems.Remove(stockItem);
}
