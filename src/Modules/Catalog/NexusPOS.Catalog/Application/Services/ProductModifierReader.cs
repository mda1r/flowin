using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using Npgsql;

namespace NexusPOS.Catalog.Application.Services;

// Adds each product's modifier groups to the product reads, so the till gets drinks and add-ons in one request.
internal sealed class ProductModifierReader(CatalogDbContext db, ITenantContext tenantContext)
{
    private static readonly IReadOnlyList<ProductModifierGroupResponse> _none = [];

    // Active groups only, in the product's order, each with its active options; products without groups get an empty list.
    public async Task<IReadOnlyDictionary<Guid, IReadOnlyList<ProductModifierGroupResponse>>> ForProductsAsync(
        IReadOnlyCollection<ProductId> productIds, CancellationToken cancellationToken = default)
    {
        Dictionary<Guid, IReadOnlyList<ProductModifierGroupResponse>> result = [];
        if (productIds.Count == 0 || tenantContext.TenantId is not Guid tenantId)
        {
            return result;
        }

        List<ProductId> ids = [.. productIds.Distinct()];
        try
        {
            List<ProductModifierGroup> links = await db.ProductModifierGroups
                .AsNoTracking()
                .Where(l => ids.Contains(l.ProductId))
                .ToListAsync(cancellationToken);
            if (links.Count == 0)
            {
                return result;
            }

            List<ModifierGroupId> groupIds = [.. links.Select(l => l.GroupId).Distinct()];
            Dictionary<ModifierGroupId, ModifierGroup> groups = await db.ModifierGroups
                .AsNoTracking()
                .Include(g => g.Options)
                .Where(g => g.TenantId == tenantId && g.IsActive && groupIds.Contains(g.Id))
                .ToDictionaryAsync(g => g.Id, cancellationToken);

            foreach (IGrouping<ProductId, ProductModifierGroup> perProduct in links.GroupBy(l => l.ProductId))
            {
                result[perProduct.Key.Value] =
                [
                    .. perProduct
                        .Where(l => groups.ContainsKey(l.GroupId))
                        .OrderBy(l => l.SortOrder)
                        .ThenBy(l => groups[l.GroupId].SortOrder)
                        .Select(l => ModifierMapper.ToProductResponse(groups[l.GroupId])),
                ];
            }
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            // Modifier tables not created yet for this tenant: products simply have no add-ons.
        }

        return result;
    }

    public static IReadOnlyList<ProductModifierGroupResponse> For(
        IReadOnlyDictionary<Guid, IReadOnlyList<ProductModifierGroupResponse>> map, Guid productId) =>
        map.TryGetValue(productId, out IReadOnlyList<ProductModifierGroupResponse>? groups) ? groups : _none;
}
