using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Domain.ValueObjects;

namespace NexusPOS.Organization.Infrastructure.Persistence.Repositories;

internal sealed class TenantRepository(OrganizationDbContext dbContext) : ITenantRepository
{
    public async Task<Tenant?> FindByIdAsync(TenantId id, CancellationToken cancellationToken = default) =>
        await dbContext.Tenants
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    public async Task<Tenant?> FindBySubdomainAsync(string subdomain, CancellationToken cancellationToken = default) =>
        await dbContext.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == subdomain, cancellationToken);

    public async Task<bool> ExistsBySubdomainAsync(string subdomain, CancellationToken cancellationToken = default) =>
        await dbContext.Tenants
            .AnyAsync(t => t.Subdomain == subdomain, cancellationToken);

    public void Add(Tenant tenant) => dbContext.Tenants.Add(tenant);

    public void Update(Tenant tenant) => dbContext.Tenants.Update(tenant);
}
