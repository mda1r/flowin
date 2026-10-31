using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using Npgsql;

namespace NexusPOS.Catalog.Application.Services;

internal sealed class ModifierOptionDirectory(CatalogDbContext db) : IModifierOptionDirectory
{
    public async Task<ModifierLookup> GetAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> optionIds,
        IReadOnlyCollection<Guid> productIds,
        CancellationToken cancellationToken = default)
    {
        if (optionIds.Count == 0 && productIds.Count == 0)
        {
            return ModifierLookup.Empty;
        }

        List<ModifierOptionId> wantedOptions = [.. optionIds.Distinct().Select(id => new ModifierOptionId(id))];
        List<ProductId> wantedProducts = [.. productIds.Distinct().Select(id => new ProductId(id))];
        try
        {
            // Options are tenant-checked through their group.
            List<ModifierOption> options = wantedOptions.Count == 0
                ? []
                : await db.ModifierOptions
                    .AsNoTracking()
                    .Where(o => wantedOptions.Contains(o.Id))
                    .Join(db.ModifierGroups.Where(g => g.TenantId == tenantId), o => o.GroupId, g => g.Id, (o, _) => o)
                    .ToListAsync(cancellationToken);

            List<ModifierGroupId> attached = wantedProducts.Count == 0
                ? []
                : await db.ProductModifierGroups
                    .AsNoTracking()
                    .Where(l => wantedProducts.Contains(l.ProductId))
                    .Select(l => l.GroupId)
                    .ToListAsync(cancellationToken);

            List<ModifierGroupId> groupIds = [.. options.Select(o => o.GroupId).Concat(attached).Distinct()];
            List<ModifierGroup> groups = groupIds.Count == 0
                ? []
                : await db.ModifierGroups
                    .AsNoTracking()
                    .Where(g => g.TenantId == tenantId && groupIds.Contains(g.Id))
                    .ToListAsync(cancellationToken);

            // Every product each group is attached to, so checkout can refuse an option sold on the wrong drink.
            List<ProductModifierGroup> groupLinks = groupIds.Count == 0
                ? []
                : await db.ProductModifierGroups
                    .AsNoTracking()
                    .Where(l => groupIds.Contains(l.GroupId))
                    .ToListAsync(cancellationToken);
            ILookup<ModifierGroupId, Guid> productsByGroup = groupLinks.ToLookup(l => l.GroupId, l => l.ProductId.Value);

            HashSet<ModifierGroupId> picked = [.. options.Select(o => o.GroupId)];
            Dictionary<Guid, ModifierGroupRules> rules = groups
                // A picked option's group comes back even when switched off, so checkout can refuse it; a group
                // reached only through a product counts only while active.
                .Where(g => g.IsActive || picked.Contains(g.Id))
                .ToDictionary(
                    g => g.Id.Value,
                    g => new ModifierGroupRules(
                        g.Id.Value, g.Name, g.IsRequired, g.MinSelect, g.MaxSelect, g.IsActive, [.. productsByGroup[g.Id]]));

            Dictionary<Guid, ModifierOptionInfo> infos = options.ToDictionary(
                o => o.Id.Value,
                o => new ModifierOptionInfo(o.Id.Value, o.GroupId.Value, o.Name, o.PriceDelta, o.IsActive));

            return new ModifierLookup(infos, rules);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            // Modifier tables not created yet for this tenant: no add-ons exist.
            return ModifierLookup.Empty;
        }
    }
}
