using NexusPOS.Zatca.Domain.Entities;

namespace NexusPOS.Zatca.Domain.Repositories;

public interface IZatcaInvoiceRepository
{
    Task<ZatcaInvoice?> FindByOrderIdAsync(Guid orderId, CancellationToken ct = default);
    Task<List<ZatcaInvoice>> ListByBranchAsync(Guid branchId, int pageSize, int pageNumber, CancellationToken ct = default);
    void Add(ZatcaInvoice invoice);
}
