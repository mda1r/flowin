using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Enums;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Queries.GetTenant;

internal sealed class GetTenantQueryHandler(
    OrganizationDbContext orgDb,
    SuperAdminDbContext superAdminDb)
    : IQueryHandler<GetTenantQuery, TenantDetailResponse>
{
    public async Task<ErrorOr<TenantDetailResponse>> Handle(
        GetTenantQuery request,
        CancellationToken cancellationToken)
    {
        var tenant = await orgDb.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == new TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return Error.NotFound("Tenant.NotFound", "المستأجر غير موجود");
        }

        var subscriptions = await superAdminDb.TenantSubscriptions
            .AsNoTracking()
            .Include(s => s.Plan)
            .Where(s => s.TenantId == request.TenantId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        var history = subscriptions.Select(MapSubscription).ToList();

        Domain.Entities.TenantSubscription? activeSub = subscriptions.FirstOrDefault(s =>
            s.Status is SubscriptionStatus.Active or SubscriptionStatus.Trial);

        return new TenantDetailResponse(
            tenant.Id.Value,
            tenant.Name,
            tenant.Subdomain,
            tenant.AdminEmail,
            tenant.Currency,
            tenant.TimeZone,
            tenant.IsActive,
            tenant.CreatedAt,
            tenant.SuspendedAt,
            activeSub is not null ? MapSubscription(activeSub) : null,
            history,
            tenant.BusinessType.ToString());
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
