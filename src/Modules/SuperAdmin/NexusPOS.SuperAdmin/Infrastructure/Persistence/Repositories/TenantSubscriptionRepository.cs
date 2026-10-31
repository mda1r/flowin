using Microsoft.EntityFrameworkCore;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Enums;
using NexusPOS.SuperAdmin.Domain.Repositories;

namespace NexusPOS.SuperAdmin.Infrastructure.Persistence.Repositories;

internal sealed class TenantSubscriptionRepository(SuperAdminDbContext context) : ITenantSubscriptionRepository
{
    public async Task<TenantSubscription?> GetActiveByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        await context.TenantSubscriptions
            .FirstOrDefaultAsync(s =>
                s.TenantId == tenantId &&
                (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial),
                cancellationToken);

    public async Task<List<TenantSubscription>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        await context.TenantSubscriptions
            .Include(s => s.Plan)
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

    public void Add(TenantSubscription subscription) => context.TenantSubscriptions.Add(subscription);
}
