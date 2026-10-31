using Microsoft.EntityFrameworkCore;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.Purchasing.Domain.ValueObjects;

namespace NexusPOS.Purchasing.Infrastructure.Persistence.Repositories;

internal sealed class SupplierRepository(PurchasingDbContext dbContext) : ISupplierRepository
{
    public async Task<Supplier?> FindByIdAsync(SupplierId id, CancellationToken cancellationToken = default)
        => await dbContext.Suppliers
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Supplier>> FindByTenantAsync(
        Guid tenantId, int page, int pageSize, CancellationToken cancellationToken = default)
        => await dbContext.Suppliers
            .Where(s => s.TenantId == tenantId && s.IsActive)
            .OrderBy(s => s.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

    public async Task<bool> ExistsByNameAsync(Guid tenantId, string name, CancellationToken cancellationToken = default)
    {
        string trimmed = name.Trim();
        return await dbContext.Suppliers
            .AnyAsync(s => s.TenantId == tenantId && EF.Functions.ILike(s.Name, trimmed), cancellationToken);
    }

    public void Add(Supplier supplier) => dbContext.Suppliers.Add(supplier);

    public void Update(Supplier supplier) => dbContext.Suppliers.Update(supplier);
}
