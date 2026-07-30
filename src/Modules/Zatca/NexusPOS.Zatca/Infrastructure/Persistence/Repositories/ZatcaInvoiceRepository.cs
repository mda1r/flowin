using Microsoft.EntityFrameworkCore;
using NexusPOS.Zatca.Domain.Entities;
using NexusPOS.Zatca.Domain.Repositories;
using NexusPOS.Zatca.Infrastructure.Persistence;

namespace NexusPOS.Zatca.Infrastructure.Persistence.Repositories;

internal sealed class ZatcaInvoiceRepository(ZatcaDbContext db) : IZatcaInvoiceRepository
{
    public async Task<ZatcaInvoice?> FindByOrderIdAsync(Guid orderId, CancellationToken ct = default) =>
        await db.ZatcaInvoices.AsNoTracking()
            .FirstOrDefaultAsync(x => x.OrderId == orderId, ct);

    public async Task<List<ZatcaInvoice>> ListByBranchAsync(Guid branchId, int pageSize, int pageNumber, CancellationToken ct = default) =>
        await db.ZatcaInvoices.AsNoTracking()
            .OrderByDescending(x => x.InvoiceDate)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public void Add(ZatcaInvoice invoice) => db.ZatcaInvoices.Add(invoice);
}
