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
        Guid branchId, DateTime? dateFrom, DateTime? dateTo, int limit, CancellationToken cancellationToken = default)
    {
        IQueryable<ReturnOrder> query = dbContext.ReturnOrders.Where(r => r.BranchId == branchId);

        if (dateFrom.HasValue)
        {
            query = query.Where(r => r.CreatedAt >= dateFrom.Value);
        }

        if (dateTo.HasValue)
        {
            query = query.Where(r => r.CreatedAt < dateTo.Value);
        }

        return await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(limit)
            .Include(r => r.Lines)
            .ToListAsync(cancellationToken);
    }

    public async Task<ReturnOrder?> FindByClientReferenceAsync(
        Guid clientReference, CancellationToken cancellationToken = default) =>
        await dbContext.ReturnOrders
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.ClientReference == clientReference, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, decimal>> FindOriginalLineCostsAsync(
        IReadOnlyCollection<Guid> orderLineIds, CancellationToken cancellationToken = default)
    {
        if (orderLineIds.Count == 0)
        {
            return new Dictionary<Guid, decimal>();
        }

        List<OrderLineId> ids = [.. orderLineIds.Distinct().Select(id => new OrderLineId(id))];
        return (await dbContext.OrderLines
                .AsNoTracking()
                .Where(l => ids.Contains(l.Id))
                .Select(l => new { l.Id, l.CostPrice })
                .ToListAsync(cancellationToken))
            .ToDictionary(l => l.Id.Value, l => l.CostPrice);
    }

    public void Add(ReturnOrder returnOrder) => dbContext.ReturnOrders.Add(returnOrder);
}
