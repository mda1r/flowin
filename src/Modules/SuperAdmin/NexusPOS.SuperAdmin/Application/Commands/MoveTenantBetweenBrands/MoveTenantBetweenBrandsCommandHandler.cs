using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Commands.MoveTenantBetweenBrands;

internal sealed class MoveTenantBetweenBrandsCommandHandler(
    OrganizationDbContext orgDb,
    SuperAdminDbContext superAdminDb)
    : ICommandHandler<MoveTenantBetweenBrandsCommand, BrandMemberResponse>
{
    public async Task<ErrorOr<BrandMemberResponse>> Handle(
        MoveTenantBetweenBrandsCommand request,
        CancellationToken cancellationToken)
    {
        bool targetBrandExists = await orgDb.Brands
            .AnyAsync(b => b.Id == request.TargetBrandId, cancellationToken);

        if (!targetBrandExists)
        {
            return Error.NotFound("Brand.NotFound", "Target brand not found");
        }

        var tenant = await orgDb.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == new TenantId(request.TenantId), cancellationToken);

        if (tenant is null)
        {
            return Error.NotFound("Tenant.NotFound", "Tenant not found");
        }

        var currentMembership = await orgDb.TenantBrandMemberships
            .FirstOrDefaultAsync(
                m => m.TenantId == request.TenantId && m.Status == MembershipStatus.Active,
                cancellationToken);

        Guid? sourceBrandId = currentMembership?.BrandId;

        if (currentMembership is not null)
        {
            if (currentMembership.BrandId == request.TargetBrandId)
            {
                return Error.Conflict("Brand.SameBrand", "Tenant is already in the target brand");
            }

            currentMembership.Unlink(request.ActorId);
        }

        TenantBrandMembership newMembership = TenantBrandMembership.Create(
            request.TargetBrandId, request.TenantId, request.ActorId,
            request.NewBranchDisplayName, request.NewBranchCode);

        orgDb.TenantBrandMemberships.Add(newMembership);

        superAdminDb.BrandAuditLogs.Add(BrandAuditLog.Record(
            BrandAuditEvents.TenantMovedBetweenBrands, request.ActorId,
            brandId: request.TargetBrandId, tenantId: request.TenantId,
            beforeJson: sourceBrandId.HasValue ? $"{{\"source_brand_id\":\"{sourceBrandId}\"}}" : null,
            afterJson: $"{{\"target_brand_id\":\"{request.TargetBrandId}\"}}"));

        await orgDb.SaveChangesAsync(cancellationToken);
        await superAdminDb.SaveChangesAsync(cancellationToken);

        return new BrandMemberResponse(
            newMembership.Id,
            tenant.Id.Value,
            tenant.Name,
            tenant.AdminEmail,
            tenant.BusinessType.ToString(),
            tenant.IsActive,
            newMembership.BranchDisplayName,
            newMembership.BranchCode,
            newMembership.Status,
            newMembership.LinkedAt);
    }
}
