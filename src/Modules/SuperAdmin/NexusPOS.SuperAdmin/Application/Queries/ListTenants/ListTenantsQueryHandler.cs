using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Enums;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Queries.ListTenants;

internal sealed class ListTenantsQueryHandler(
    OrganizationDbContext orgDb,
    SuperAdminDbContext superAdminDb)
    : IQueryHandler<ListTenantsQuery, List<TenantWithSubscriptionResponse>>
{
    public async Task<ErrorOr<List<TenantWithSubscriptionResponse>>> Handle(
        ListTenantsQuery request,
        CancellationToken cancellationToken)
    {
        var tenants = await orgDb.Tenants
            .AsNoTracking()
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        var tenantIds = tenants.Select(t => t.Id.Value).ToList();

        var subscriptions = await superAdminDb.TenantSubscriptions
            .AsNoTracking()
            .Include(s => s.Plan)
            .Where(s => tenantIds.Contains(s.TenantId) && s.Status != SubscriptionStatus.Cancelled)
            .ToListAsync(cancellationToken);

        DateTime now = DateTime.UtcNow;
        Dictionary<Guid, TenantSubscription?> subByTenant = subscriptions
            .GroupBy(s => s.TenantId)
            .ToDictionary(g => g.Key, g => TenantSubscription.PickCurrent(g, now));

        var result = tenants.Select(t =>
        {
            TenantSubscriptionResponse? activeSub = null;
            if (subByTenant.TryGetValue(t.Id.Value, out var sub) && sub is not null)
            {
                activeSub = sub.ToResponse(now);
            }

            return new TenantWithSubscriptionResponse(
                t.Id.Value,
                t.Name,
                t.Subdomain,
                t.AdminEmail,
                t.Currency,
                t.TimeZone,
                t.IsActive,
                t.CreatedAt,
                t.SuspendedAt,
                activeSub,
                t.BusinessType.ToString());
        }).ToList();

        return result;
    }
}
