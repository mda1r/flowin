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

        tenant.Suspend();
        await orgDb.SaveChangesAsync(cancellationToken);

        var activeSub = await subscriptionRepository.GetActiveByTenantIdAsync(request.TenantId, cancellationToken);
        if (activeSub is not null)
        {
            activeSub.Suspend();
            await superAdminDb.SaveChangesAsync(cancellationToken);
        }

        return Result.Success;
    }
}
