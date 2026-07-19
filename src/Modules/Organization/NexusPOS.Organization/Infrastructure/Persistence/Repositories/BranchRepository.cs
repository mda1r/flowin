using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;

namespace NexusPOS.Organization.Infrastructure.Persistence.Repositories;

internal sealed class BranchRepository(OrganizationDbContext dbContext) : IBranchRepository
{
    public async Task<Branch?> FindByIdAsync(BranchId id, CancellationToken cancellationToken = default) =>
        await dbContext.Branches
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Branch>> FindByTenantIdAsync(
        TenantId tenantId, CancellationToken cancellationToken = default)
    {
        return await dbContext.Branches
            .Where(b => b.TenantId == tenantId)
            .OrderBy(b => b.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> ExistsByNameAsync(
        TenantId tenantId, string name, CancellationToken cancellationToken = default) =>
        await dbContext.Branches
            .AnyAsync(
                b => b.TenantId == tenantId && b.Name == name.Trim(),
                cancellationToken);

    public void Add(Branch branch) => dbContext.Branches.Add(branch);

    public void Update(Branch branch) => dbContext.Branches.Update(branch);
}
