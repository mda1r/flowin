using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Domain.Enums;
using NexusPOS.SuperAdmin.Domain.Repositories;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.ActivateTenant;

internal sealed class ActivateTenantCommandHandler(
    OrganizationDbContext orgDb,
    ITenantSubscriptionRepository subscriptionRepository,
    SuperAdminDbContext superAdminDb)
    : ICommandHandler<ActivateTenantCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        ActivateTenantCommand request,
        CancellationToken cancellationToken)
    {
        var tenant = await orgDb.Tenants
            .FirstOrDefaultAsync(t => t.Id == new TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return Error.NotFound("Tenant.NotFound", "المستأجر غير موجود");
        }

        tenant.Reinstate();
        await orgDb.SaveChangesAsync(cancellationToken);

        var suspendedSubs = (await subscriptionRepository.GetByTenantIdAsync(request.TenantId, cancellationToken))
            .Where(s => s.Status == SubscriptionStatus.Suspended)
            .ToList();

        if (suspendedSubs.Count > 0)
        {
            suspendedSubs.ForEach(s => s.Activate());
            await superAdminDb.SaveChangesAsync(cancellationToken);
        }

        return Result.Success;
    }
}
