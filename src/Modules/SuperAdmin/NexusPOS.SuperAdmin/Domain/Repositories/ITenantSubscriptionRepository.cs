using NexusPOS.SuperAdmin.Domain.Entities;

namespace NexusPOS.SuperAdmin.Domain.Repositories;

public interface ITenantSubscriptionRepository
{
    Task<List<TenantSubscription>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    void Add(TenantSubscription subscription);
}
