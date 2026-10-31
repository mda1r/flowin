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
        Guid tenantId, int page, int pageSize, bool includeInactive = false, CancellationToken cancellationToken = default)
        => await dbContext.Suppliers
            .Where(s => s.TenantId == tenantId && (includeInactive || s.IsActive))
            .OrderByDescending(s => s.IsActive)
            .ThenBy(s => s.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

    // Includes inactive suppliers so past orders keep showing who they were placed with.
    public async Task<IReadOnlyDictionary<Guid, string>> FindNamesAsync(
        IReadOnlyCollection<Guid> supplierIds, CancellationToken cancellationToken = default)
    {
        if (supplierIds.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        List<SupplierId> ids = supplierIds.Select(id => new SupplierId(id)).ToList();
        return await dbContext.Suppliers
            .Where(s => ids.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id.Value, s => s.Name, cancellationToken);
    }

    public async Task<bool> ExistsByNameAsync(Guid tenantId, string name, CancellationToken cancellationToken = default)
    {
        string trimmed = name.Trim();
        return await dbContext.Suppliers
            .AnyAsync(s => s.TenantId == tenantId && EF.Functions.ILike(s.Name, trimmed), cancellationToken);
    }

    public void Add(Supplier supplier) => dbContext.Suppliers.Add(supplier);

    public void Update(Supplier supplier) => dbContext.Suppliers.Update(supplier);
}
