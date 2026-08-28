using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Queries.GetTaxScopesByBrand;

internal sealed class GetTaxScopesByBrandQueryHandler(
    TaxConfigDbContext taxDb,
    OrganizationDbContext orgDb)
    : IQueryHandler<GetTaxScopesByBrandQuery, List<TaxScopeResponse>>
{
    public async Task<ErrorOr<List<TaxScopeResponse>>> Handle(
        GetTaxScopesByBrandQuery request,
        CancellationToken cancellationToken)
    {
        var scopes = await taxDb.TaxRegistrationScopes
            .AsNoTracking()
            .Include(s => s.Memberships)
            .Where(s => s.BrandId == request.BrandId)
            .OrderBy(s => s.Name)
            .ToListAsync(cancellationToken);

        var allTenantIds = scopes
            .SelectMany(s => s.Memberships.Select(m => new TenantId(m.TenantId)))
            .Distinct()
            .ToList();

        var tenants = await orgDb.Tenants
            .AsNoTracking()
            .Where(t => allTenantIds.Contains(t.Id))
            .ToListAsync(cancellationToken);

        var tenantById = tenants.ToDictionary(t => t.Id.Value);

        var result = scopes.Select(s => new TaxScopeResponse(
            s.Id, s.Name, s.VatRegistrationNumber, s.LegalEntityName, s.IsActive, s.CreatedAt,
            s.Memberships.Select(m =>
            {
                tenantById.TryGetValue(m.TenantId, out var t);
                return new TaxScopeMemberResponse(
                    m.Id, m.TenantId, t?.Name ?? "Unknown",
                    m.EffectiveFrom, m.EffectiveTo);
            }).ToList()
        )).ToList();

        return result;
    }
}
