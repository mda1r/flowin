using Microsoft.EntityFrameworkCore;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Repositories;

namespace NexusPOS.SuperAdmin.Infrastructure.Persistence.Repositories;

internal sealed class TenantSubscriptionRepository(SuperAdminDbContext context) : ITenantSubscriptionRepository
{
    public async Task<List<TenantSubscription>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        await context.TenantSubscriptions
            .Include(s => s.Plan)
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

    public void Add(TenantSubscription subscription) => context.TenantSubscriptions.Add(subscription);
}
