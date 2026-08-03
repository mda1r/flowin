using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateTenant;

internal sealed class CreateTenantCommandHandler(
    OrganizationDbContext orgDb,
    IUserProvisioningService userProvisioning,
    ITenantSchemaProvisioner schemaProvisioner)
    : ICommandHandler<CreateTenantCommand, TenantWithSubscriptionResponse>
{
    public async Task<ErrorOr<TenantWithSubscriptionResponse>> Handle(
        CreateTenantCommand request,
        CancellationToken cancellationToken)
    {
        string subdomain = request.Subdomain.ToLowerInvariant();
        bool subdomainTaken = await orgDb.Tenants
            .AnyAsync(t => EF.Functions.ILike(t.Subdomain, subdomain), cancellationToken);

        if (subdomainTaken)
        {
            return Error.Conflict("Tenant.SubdomainTaken", $"النطاق '{request.Subdomain}' مستخدم بالفعل");
        }

        string adminEmail = request.AdminEmail.ToLowerInvariant();
        bool emailTaken = await orgDb.Tenants
            .AnyAsync(t => EF.Functions.ILike(t.AdminEmail, adminEmail), cancellationToken);

        if (emailTaken)
        {
            return Error.Conflict("Tenant.EmailTaken", $"البريد الإلكتروني '{request.AdminEmail}' مستخدم بالفعل");
        }

        if (!Enum.TryParse<BusinessType>(request.BusinessType, out BusinessType businessType))
        {
            return Error.Validation("Tenant.InvalidBusinessType", "نوع النشاط التجاري غير صالح");
        }

        Tenant tenant = Tenant.Create(
            request.Name,
            request.Subdomain,
            request.AdminEmail,
            request.Currency,
            request.TimeZone,
            businessType);

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

        await orgDb.SaveChangesAsync(cancellationToken);

        // Provision isolated PostgreSQL schema immediately upon tenant creation
        await schemaProvisioner.ProvisionAsync(tenant.Id.Value, cancellationToken);

        string defaultPassword = await userProvisioning.CreateTenantAdminAsync(
            adminEmail,
            "Admin",
            tenant.Name,
            tenant.Id.Value,
            cancellationToken);

        return new TenantWithSubscriptionResponse(
            tenant.Id.Value,
            tenant.Name,
            tenant.Subdomain,
            tenant.AdminEmail,
            tenant.Currency,
            tenant.TimeZone,
            tenant.IsActive,
            tenant.CreatedAt,
            tenant.SuspendedAt,
            null,
            tenant.BusinessType.ToString(),
            defaultPassword);
    }
}
