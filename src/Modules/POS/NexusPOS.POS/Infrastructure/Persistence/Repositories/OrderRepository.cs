using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Infrastructure.Persistence.Repositories;

internal sealed class OrderRepository(PosDbContext dbContext) : IOrderRepository
{
    public async Task<Order?> FindByIdAsync(OrderId id, CancellationToken cancellationToken = default)
    {
        return await dbContext.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Order>> FindByBranchAsync(
        Guid branchId,
        OrderStatus? status,
        DateTime? dateFrom,
        DateTime? dateTo,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        IQueryable<Order> query = dbContext.Orders
            .Include(o => o.Lines)
            .Where(o => o.BranchId == branchId);

        if (status.HasValue)
        {
            query = query.Where(o => o.Status == status.Value);
        }

        if (dateFrom.HasValue)
        {
            query = query.Where(o => o.CreatedAt >= dateFrom.Value);
        }

        if (dateTo.HasValue)
        {
            query = query.Where(o => o.CreatedAt <= dateTo.Value);
        }

        return await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public void Add(Order order) => dbContext.Orders.Add(order);

    public void Update(Order order) => dbContext.Orders.Update(order);
}
