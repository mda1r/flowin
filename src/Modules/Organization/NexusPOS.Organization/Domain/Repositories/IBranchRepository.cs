using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.ValueObjects;

namespace NexusPOS.Organization.Domain.Repositories;

public interface IBranchRepository
{
    Task<Branch?> FindByIdAsync(BranchId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Branch>> FindByTenantIdAsync(TenantId tenantId, CancellationToken cancellationToken = default);
    Task<bool> ExistsByNameAsync(TenantId tenantId, string name, CancellationToken cancellationToken = default);
    void Add(Branch branch);
    void Update(Branch branch);
}
