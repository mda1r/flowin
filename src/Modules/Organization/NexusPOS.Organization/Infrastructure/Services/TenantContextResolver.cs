using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.Organization.Infrastructure.Services;

internal sealed class TenantContextResolver(OrganizationDbContext db) : ITenantContextResolver
{
    public async Task<TenantContext?> ResolveAsync(Guid? tenantId, string email, CancellationToken ct)
    {
        Tenant? tenant;

        if (tenantId.HasValue)
        {
            var tenantIdVo = new TenantId(tenantId.Value);
            tenant = await db.Tenants
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == tenantIdVo, ct);
        }
        else
        {
            string normalised = email.ToLowerInvariant();
            tenant = await db.Tenants
                .AsNoTracking()
                .FirstOrDefaultAsync(t => EF.Functions.ILike(t.AdminEmail, normalised), ct);
        }

        if (tenant is null)
        {
            return null;
        }

        var branch = await db.Branches
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.TenantId == tenant.Id && b.IsMainBranch, ct);

        return new TenantContext(tenant.Id.Value, branch?.Id.Value, tenant.BusinessType.ToString());
    }
}
