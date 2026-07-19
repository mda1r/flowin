using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.ValueObjects;

namespace NexusPOS.Organization.Domain.Repositories;

public interface ITenantRepository
{
    Task<Tenant?> FindByIdAsync(TenantId id, CancellationToken cancellationToken = default);
    Task<Tenant?> FindBySubdomainAsync(string subdomain, CancellationToken cancellationToken = default);
    Task<bool> ExistsBySubdomainAsync(string subdomain, CancellationToken cancellationToken = default);
    void Add(Tenant tenant);
    void Update(Tenant tenant);
}
