using Microsoft.EntityFrameworkCore;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Enums;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;

namespace NexusPOS.Purchasing.Infrastructure.Persistence.Repositories;

internal sealed class PurchaseOrderRepository(PurchasingDbContext dbContext) : IPurchaseOrderRepository
{
    public async Task<PurchaseOrder?> FindByIdAsync(PurchaseOrderId id, CancellationToken cancellationToken = default)
        => await dbContext.PurchaseOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

    public async Task<IReadOnlyList<PurchaseOrder>> FindByBranchAsync(
        Guid branchId,
        PurchaseOrderStatus? status,
        Guid? supplierId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        IQueryable<PurchaseOrder> query = dbContext.PurchaseOrders
            .Include(o => o.Lines)
            .Where(o => o.BranchId == branchId);

        if (status.HasValue)
        {
            query = query.Where(o => o.Status == status.Value);
        }

        if (supplierId.HasValue)
        {
            SupplierId sid = new(supplierId.Value);
            query = query.Where(o => o.SupplierId == sid);
        }

        return await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public void Add(PurchaseOrder order) => dbContext.PurchaseOrders.Add(order);

    public void Update(PurchaseOrder order) => dbContext.PurchaseOrders.Update(order);
}
