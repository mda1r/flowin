using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Repositories;

internal sealed class StockCountRepository(InventoryDbContext dbContext) : IStockCountRepository
{
    public async Task<StockCountSession?> FindByIdAsync(
        StockCountSessionId id, CancellationToken cancellationToken = default) =>
        await dbContext.StockCountSessions
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public async Task<IReadOnlyList<StockCountSession>> FindByBranchAsync(
        Guid branchId, CancellationToken cancellationToken = default) =>
        await dbContext.StockCountSessions
            .Include(s => s.Items)
            .Where(s => s.BranchId == branchId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

    public void Add(StockCountSession session) => dbContext.StockCountSessions.Add(session);

    public void Update(StockCountSession session) => dbContext.StockCountSessions.Update(session);
}
