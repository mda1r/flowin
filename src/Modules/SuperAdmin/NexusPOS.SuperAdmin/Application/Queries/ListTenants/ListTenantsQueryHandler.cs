using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Application.Common;
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
            .Where(s => tenantIds.Contains(s.TenantId)
                && (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial))
            .ToListAsync(cancellationToken);

        var subByTenant = subscriptions.ToDictionary(s => s.TenantId);

        var result = tenants.Select(t =>
        {
            TenantSubscriptionResponse? activeSub = null;
            if (subByTenant.TryGetValue(t.Id.Value, out var sub))
            {
                activeSub = MapSubscription(sub);
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

    private static TenantSubscriptionResponse MapSubscription(Domain.Entities.TenantSubscription sub)
    {
        int daysRemaining = (int)(sub.ExpiryDate - DateTime.UtcNow).TotalDays;

        return new TenantSubscriptionResponse(
            sub.Id,
            sub.TenantId,
            sub.PlanId,
            sub.Plan?.Name ?? string.Empty,
            sub.Plan?.Price ?? 0,
            sub.StartDate,
            sub.ExpiryDate,
            sub.Status,
            sub.MaxBranches,
            sub.MaxUsers,
            sub.Notes,
            sub.CreatedAt,
            daysRemaining);
    }
}
