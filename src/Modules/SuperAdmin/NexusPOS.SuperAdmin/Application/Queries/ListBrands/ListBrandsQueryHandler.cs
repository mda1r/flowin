using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Queries.ListBrands;

internal sealed class ListBrandsQueryHandler(OrganizationDbContext orgDb)
    : IQueryHandler<ListBrandsQuery, ListBrandsResult>
{
    public async Task<ErrorOr<ListBrandsResult>> Handle(
        ListBrandsQuery request,
        CancellationToken cancellationToken)
    {
        var query = orgDb.Brands.AsNoTracking();

        if (!string.IsNullOrEmpty(request.Status))
        {
            query = query.Where(b => b.Status == request.Status);
        }

        if (!string.IsNullOrEmpty(request.Search))
        {
            string search = request.Search.Trim().ToLowerInvariant();
            query = query.Where(b =>
                EF.Functions.ILike(b.NameAr, $"%{search}%") ||
                EF.Functions.ILike(b.NameEn, $"%{search}%") ||
                EF.Functions.ILike(b.Code, $"%{search}%"));
        }

        int total = await query.CountAsync(cancellationToken);

        var brands = await query
            .OrderBy(b => b.NameEn)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var brandIds = brands.Select(b => b.Id).ToList();

        var memberCounts = await orgDb.TenantBrandMemberships
            .AsNoTracking()
            .Where(m => brandIds.Contains(m.BrandId) && m.UnlinkedAt == null)
            .GroupBy(m => m.BrandId)
            .Select(g => new { BrandId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var countByBrand = memberCounts.ToDictionary(x => x.BrandId, x => x.Count);

        var items = brands.Select(b => new BrandResponse(
            b.Id, b.NameAr, b.NameEn, b.Code, b.Status, b.Notes,
            countByBrand.GetValueOrDefault(b.Id, 0),
            b.CreatedAt)).ToList();

        return new ListBrandsResult(items, total, request.Page, request.PageSize);
    }
}
