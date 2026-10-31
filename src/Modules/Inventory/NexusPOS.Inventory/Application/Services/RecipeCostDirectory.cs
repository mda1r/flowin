using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Domain.Services;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using Npgsql;

namespace NexusPOS.Inventory.Application.Services;

internal sealed class RecipeCostDirectory(InventoryDbContext db) : IRecipeCostDirectory
{
    public async Task<IReadOnlyDictionary<Guid, decimal>> GetCostsAsync(
        Guid tenantId, IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken = default)
    {
        if (variantIds.Count == 0)
        {
            return new Dictionary<Guid, decimal>();
        }

        List<Guid> ids = [.. variantIds.Distinct()];
        try
        {
            var rows = await db.RecipeLines
                .AsNoTracking()
                .Where(r => r.TenantId == tenantId && ids.Contains(r.VariantId))
                .Join(db.StockMaterials.Where(m => m.TenantId == tenantId), r => r.MaterialId, m => m.Id,
                    (r, m) => new { r.VariantId, r.Quantity, m.CurrentCost, m.ConversionFactor })
                .ToListAsync(cancellationToken);

            return rows
                .GroupBy(x => x.VariantId)
                .ToDictionary(
                    g => g.Key,
                    g => RecipeCosting.Total(g.Select(x => RecipeCosting.LineCost(x.Quantity, x.CurrentCost, x.ConversionFactor))));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            // Inventory tables not created yet for this tenant: no recipes, so the sale falls back to the catalog cost.
            return new Dictionary<Guid, decimal>();
        }
    }
}
