using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.POS.Infrastructure.Services;

internal sealed class PosSaleDirectory(PosDbContext db) : IPosSaleDirectory
{
    public async Task<IReadOnlyList<PosSaleLine>?> GetCompletedSaleLinesAsync(
        Guid branchId, Guid orderId, CancellationToken cancellationToken = default)
    {
        OrderId id = new(orderId);
        Order? order = await db.Orders
            .AsNoTracking()
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id && o.BranchId == branchId, cancellationToken);

        if (order is null || order.Status != OrderStatus.Completed)
        {
            return null;
        }

        return [.. order.Lines.Select(l => new PosSaleLine(
            l.VariantId, l.ProductName, l.Quantity, Math.Round(l.UnitPrice.Amount * (1 + order.TaxRate), 2)))];
    }
}
