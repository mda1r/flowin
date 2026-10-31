using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateTenantAndLinkToBrand;

internal sealed class CreateTenantAndLinkToBrandCommandHandler(
    OrganizationDbContext orgDb,
    SuperAdminDbContext superAdminDb,
    IUserProvisioningService userProvisioning,
    ITenantSchemaProvisioner schemaProvisioner)
    : ICommandHandler<CreateTenantAndLinkToBrandCommand, BrandMemberResponse>
{
    public async Task<ErrorOr<BrandMemberResponse>> Handle(
        CreateTenantAndLinkToBrandCommand request,
        CancellationToken cancellationToken)
    {
        bool brandExists = await orgDb.Brands
            .AnyAsync(b => b.Id == request.BrandId, cancellationToken);

        if (!brandExists)
        {
            return Error.NotFound("Brand.NotFound", "Brand not found");
        }

        string subdomain = request.Subdomain.ToLowerInvariant();
        bool subdomainTaken = await orgDb.Tenants
            .AnyAsync(t => EF.Functions.ILike(t.Subdomain, subdomain), cancellationToken);

        if (subdomainTaken)
        {
            return Error.Conflict("Tenant.SubdomainTaken", $"Subdomain '{request.Subdomain}' is already in use");
        }

        string adminEmail = request.AdminEmail.ToLowerInvariant();
        bool emailTaken = await orgDb.Tenants
            .AnyAsync(t => EF.Functions.ILike(t.AdminEmail, adminEmail), cancellationToken);

        if (emailTaken)
        {
            return Error.Conflict("Tenant.EmailTaken", $"Email '{request.AdminEmail}' is already in use");
        }

        if (!Enum.TryParse<BusinessType>(request.BusinessType, out BusinessType businessType))
        {
            return Error.Validation("Tenant.InvalidBusinessType", "Invalid business type");
        }

        Tenant tenant = Tenant.Create(
            request.Name, request.Subdomain, request.AdminEmail,
            request.Currency, request.TimeZone, businessType);

        tenant.ClearDomainEvents();
        orgDb.Tenants.Add(tenant);

        BranchType branchType = businessType switch
        {
            BusinessType.Restaurant or BusinessType.Cafe => BranchType.Restaurant,
            BusinessType.Hotel => BranchType.Hotel,
            BusinessType.Gaming => BranchType.Gaming,
            _ => BranchType.Retail,
        };

        Branch branch = Branch.Create(tenant.Id, "الفرع الرئيسي", branchType, isMainBranch: true);
        branch.ClearDomainEvents();
        orgDb.Branches.Add(branch);

        TenantBrandMembership membership = TenantBrandMembership.Create(
            request.BrandId, tenant.Id.Value, request.ActorId,
            request.BranchDisplayName, request.BranchCode);

        orgDb.TenantBrandMemberships.Add(membership);

        superAdminDb.BrandAuditLogs.Add(BrandAuditLog.Record(
            BrandAuditEvents.BranchAccountCreatedUnderBrand, request.ActorId,
            brandId: request.BrandId, tenantId: tenant.Id.Value));

        await orgDb.SaveChangesAsync(cancellationToken);
        await schemaProvisioner.ProvisionAsync(tenant.Id.Value, cancellationToken);
        await userProvisioning.CreateTenantAdminAsync(
            adminEmail, "Admin", tenant.Name, tenant.Id.Value, cancellationToken);
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
