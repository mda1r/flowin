using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Queries.GetBrandDetail;

internal sealed class GetBrandDetailQueryHandler(
    OrganizationDbContext orgDb,
    TaxConfigDbContext taxDb)
    : IQueryHandler<GetBrandDetailQuery, BrandDetailResponse>
{
    public async Task<ErrorOr<BrandDetailResponse>> Handle(
        GetBrandDetailQuery request,
        CancellationToken cancellationToken)
    {
        var brand = await orgDb.Brands
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == request.BrandId, cancellationToken);

        if (brand is null)
        {
            return Error.NotFound("Brand.NotFound", "Brand not found");
        }

        var memberships = await orgDb.TenantBrandMemberships
            .AsNoTracking()
            .Where(m => m.BrandId == request.BrandId)
            .OrderByDescending(m => m.LinkedAt)
            .ToListAsync(cancellationToken);

        var tenantIds = memberships.Select(m => new TenantId(m.TenantId)).ToList();

        var tenants = await orgDb.Tenants
            .AsNoTracking()
            .Where(t => tenantIds.Contains(t.Id))
            .ToListAsync(cancellationToken);

        var tenantById = tenants.ToDictionary(t => t.Id.Value);

        var members = memberships.Select(m =>
        {
            tenantById.TryGetValue(m.TenantId, out var tenant);
            return new BrandMemberResponse(
                m.Id,
                m.TenantId,
                tenant?.Name ?? "Unknown",
                tenant?.AdminEmail ?? "Unknown",
                tenant?.BusinessType.ToString() ?? "Unknown",
                tenant?.IsActive ?? false,
                m.BranchDisplayName,
                m.BranchCode,
                m.Status,
                m.LinkedAt);
        }).ToList();

        int activeCount = members.Count(m => m.MembershipStatus == Organization.Domain.Entities.MembershipStatus.Active);

        var taxScopes = await taxDb.TaxRegistrationScopes
            .AsNoTracking()
            .Include(s => s.Memberships)
            .Where(s => s.BrandId == request.BrandId)
            .OrderBy(s => s.Name)
            .ToListAsync(cancellationToken);

        var taxScopeTenantIds = taxScopes
            .SelectMany(s => s.Memberships.Select(m => new TenantId(m.TenantId)))
            .Distinct()
            .ToList();

        Dictionary<Guid, string> taxTenantNames = taxScopeTenantIds.Count > 0
            ? (await orgDb.Tenants.AsNoTracking()
                .Where(t => taxScopeTenantIds.Contains(t.Id))
                .ToListAsync(cancellationToken))
                .ToDictionary(t => t.Id.Value, t => t.Name)
            : [];

        var taxScopeResponses = taxScopes.Select(s => new TaxScopeResponse(
            s.Id, s.Name, s.VatRegistrationNumber, s.LegalEntityName, s.IsActive, s.CreatedAt,
            s.Memberships.Select(m => new TaxScopeMemberResponse(
                m.Id, m.TenantId,
                taxTenantNames.GetValueOrDefault(m.TenantId, "Unknown"),
                m.EffectiveFrom, m.EffectiveTo)).ToList()
        )).ToList();

        return new BrandDetailResponse(
            brand.Id,
            brand.NameAr,
            brand.NameEn,
            brand.Code,
            brand.Status,
            brand.Notes,
            activeCount,
            brand.CreatedAt,
            members,
            taxScopeResponses);
    }
}
