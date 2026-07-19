using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.ValueObjects;

namespace NexusPOS.Purchasing.Domain.Repositories;

public interface ISupplierRepository
{
    Task<Supplier?> FindByIdAsync(SupplierId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Supplier>> FindByTenantAsync(Guid tenantId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<bool> ExistsByNameAsync(Guid tenantId, string name, CancellationToken cancellationToken = default);
    void Add(Supplier supplier);
    void Update(Supplier supplier);
}
