using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Application.Common;
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

        DateTime now = DateTime.UtcNow;
        var history = subscriptions.Select(s => s.ToResponse(now)).ToList();

        Domain.Entities.TenantSubscription? activeSub = Domain.Entities.TenantSubscription.PickCurrent(subscriptions, now);

        bool aiEnabled = await superAdminDb.TenantAiAccesses
            .AsNoTracking()
            .Where(a => a.TenantId == request.TenantId)
            .Select(a => a.AiEnabled)
            .FirstOrDefaultAsync(cancellationToken);

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
            activeSub?.ToResponse(now),
            history,
            tenant.BusinessType.ToString(),
            aiEnabled,
            tenant.SuspensionReason);
    }
}
