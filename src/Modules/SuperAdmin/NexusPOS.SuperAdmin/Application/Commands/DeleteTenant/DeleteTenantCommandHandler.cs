using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Commands.DeleteTenant;

internal sealed class DeleteTenantCommandHandler(
    OrganizationDbContext orgDb,
    SuperAdminDbContext superAdminDb,
    IUserProvisioningService userProvisioning)
    : ICommandHandler<DeleteTenantCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        DeleteTenantCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = new TenantId(request.TenantId);
        var tenant = await orgDb.Tenants
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return Error.NotFound("Tenant.NotFound", "المستأجر غير موجود");
        }

        // Remove branches
        var branches = await orgDb.Branches
            .Where(b => b.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        orgDb.Branches.RemoveRange(branches);

        // Remove subscriptions
        var subs = await superAdminDb.TenantSubscriptions
            .Where(s => s.TenantId == request.TenantId)
            .ToListAsync(cancellationToken);
        superAdminDb.TenantSubscriptions.RemoveRange(subs);

        // Remove tenant
        orgDb.Tenants.Remove(tenant);

        await orgDb.SaveChangesAsync(cancellationToken);
        await superAdminDb.SaveChangesAsync(cancellationToken);

        // Deactivate IAM users belonging to this tenant
        await userProvisioning.DeactivateAllTenantUsersAsync(request.TenantId, cancellationToken);

        return Result.Success;
    }
}
