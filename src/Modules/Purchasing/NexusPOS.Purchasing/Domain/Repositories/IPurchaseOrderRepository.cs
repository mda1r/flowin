using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Enums;
using NexusPOS.Purchasing.Domain.ValueObjects;

namespace NexusPOS.Purchasing.Domain.Repositories;

public interface IPurchaseOrderRepository
{
    Task<PurchaseOrder?> FindByIdAsync(PurchaseOrderId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PurchaseOrder>> FindByBranchAsync(Guid branchId, PurchaseOrderStatus? status, Guid? supplierId, int page, int pageSize, CancellationToken cancellationToken = default);
    void Add(PurchaseOrder order);
    void Update(PurchaseOrder order);
}
