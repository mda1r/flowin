using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Commands.LinkTenantToBrand;

internal sealed class LinkTenantToBrandCommandHandler(
    OrganizationDbContext orgDb,
    SuperAdminDbContext superAdminDb)
    : ICommandHandler<LinkTenantToBrandCommand, BrandMemberResponse>
{
    public async Task<ErrorOr<BrandMemberResponse>> Handle(
        LinkTenantToBrandCommand request,
        CancellationToken cancellationToken)
    {
        bool brandExists = await orgDb.Brands
            .AnyAsync(b => b.Id == request.BrandId, cancellationToken);

        if (!brandExists)
        {
            return Error.NotFound("Brand.NotFound", "Brand not found");
        }

        var tenant = await orgDb.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == new NexusPOS.Organization.Domain.ValueObjects.TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return Error.NotFound("Tenant.NotFound", "Tenant not found");
        }

        bool alreadyLinked = await orgDb.TenantBrandMemberships
            .AnyAsync(m => m.TenantId == request.TenantId && m.Status == MembershipStatus.Active, cancellationToken);

        if (alreadyLinked)
        {
            return Error.Conflict("Brand.TenantAlreadyLinked", "Tenant is already linked to a brand");
        }

        TenantBrandMembership membership = TenantBrandMembership.Create(
            request.BrandId, request.TenantId, request.ActorId,
            request.BranchDisplayName, request.BranchCode);

        orgDb.TenantBrandMemberships.Add(membership);

        superAdminDb.BrandAuditLogs.Add(BrandAuditLog.Record(
            BrandAuditEvents.TenantLinkedToBrand, request.ActorId,
            brandId: request.BrandId, tenantId: request.TenantId));

        await orgDb.SaveChangesAsync(cancellationToken);
        await superAdminDb.SaveChangesAsync(cancellationToken);

        return new BrandMemberResponse(
            membership.Id,
            tenant.Id.Value,
            tenant.Name,
            tenant.AdminEmail,
            tenant.BusinessType.ToString(),
            tenant.IsActive,
            membership.BranchDisplayName,
            membership.BranchCode,
            membership.Status,
            membership.LinkedAt);
    }
}
