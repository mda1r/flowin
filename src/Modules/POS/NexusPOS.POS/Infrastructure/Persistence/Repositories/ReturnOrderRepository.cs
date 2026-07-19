using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Infrastructure.Persistence.Repositories;

internal sealed class ReturnOrderRepository(PosDbContext dbContext) : IReturnOrderRepository
{
    public async Task<ReturnOrder?> FindByIdAsync(ReturnOrderId id, CancellationToken cancellationToken = default) =>
        await dbContext.ReturnOrders
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task<IReadOnlyList<ReturnOrder>> FindByOriginalOrderAsync(
        Guid originalOrderId, CancellationToken cancellationToken = default) =>
        await dbContext.ReturnOrders
            .Include(r => r.Lines)
            .Where(r => r.OriginalOrderId == originalOrderId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ReturnOrder>> FindByBranchAsync(
        Guid branchId, CancellationToken cancellationToken = default) =>
        await dbContext.ReturnOrders
            .Include(r => r.Lines)
            .Where(r => r.BranchId == branchId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

    public void Add(ReturnOrder returnOrder) => dbContext.ReturnOrders.Add(returnOrder);
}
