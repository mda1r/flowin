using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Commands.UnlinkTenantFromBrand;

internal sealed class UnlinkTenantFromBrandCommandHandler(
    OrganizationDbContext orgDb,
    SuperAdminDbContext superAdminDb)
    : ICommandHandler<UnlinkTenantFromBrandCommand, bool>
{
    public async Task<ErrorOr<bool>> Handle(
        UnlinkTenantFromBrandCommand request,
        CancellationToken cancellationToken)
    {
        var membership = await orgDb.TenantBrandMemberships
            .FirstOrDefaultAsync(m => m.Id == request.MembershipId, cancellationToken);

        if (membership is null)
        {
            return Error.NotFound("Membership.NotFound", "Membership not found");
        }

        if (membership.Status == Organization.Domain.Entities.MembershipStatus.Unlinked)
        {
            return Error.Conflict("Membership.AlreadyUnlinked", "Tenant is already unlinked from this brand");
        }

        membership.Unlink(request.ActorId);

        superAdminDb.BrandAuditLogs.Add(BrandAuditLog.Record(
            BrandAuditEvents.TenantUnlinkedFromBrand, request.ActorId,
            brandId: membership.BrandId, tenantId: membership.TenantId));

        await orgDb.SaveChangesAsync(cancellationToken);
        await superAdminDb.SaveChangesAsync(cancellationToken);

        return true;
    }
}
