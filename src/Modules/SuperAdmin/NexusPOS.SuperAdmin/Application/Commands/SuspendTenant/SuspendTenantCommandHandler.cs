using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Domain.Repositories;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.SuspendTenant;

internal sealed class SuspendTenantCommandHandler(
    OrganizationDbContext orgDb,
    ITenantSubscriptionRepository subscriptionRepository,
    SuperAdminDbContext superAdminDb)
    : ICommandHandler<SuspendTenantCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        SuspendTenantCommand request,
        CancellationToken cancellationToken)
    {
        var tenant = await orgDb.Tenants
            .FirstOrDefaultAsync(t => t.Id == new TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return Error.NotFound("Tenant.NotFound", "المستأجر غير موجود");
        }

        // Login and token refresh check Tenant.IsActive, so this is what actually stops the tenant.
        tenant.Suspend(request.Reason);
        await orgDb.SaveChangesAsync(cancellationToken);

        // Suspend every live or upcoming subscription, not just the first, so none keeps granting features.
        DateTime now = DateTime.UtcNow;
        var running = (await subscriptionRepository.GetByTenantIdAsync(request.TenantId, cancellationToken))
            .Where(s => s.IsRunning && s.ExpiryDate >= now)
            .ToList();

        if (running.Count > 0)
        {
            running.ForEach(s => s.Suspend());
            await superAdminDb.SaveChangesAsync(cancellationToken);
        }

        return Result.Success;
    }
}
