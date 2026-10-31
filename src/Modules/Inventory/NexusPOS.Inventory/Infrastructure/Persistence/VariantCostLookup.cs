using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Services;
using Npgsql;

namespace NexusPOS.Inventory.Infrastructure.Persistence;

internal sealed class VariantCostLookup(InventoryDbContext db) : IVariantCostLookup
{
    public async Task<IReadOnlyDictionary<Guid, decimal>> GetCostsAsync(
        IReadOnlyCollection<Guid> variantIds,
        CancellationToken cancellationToken = default)
    {
        if (variantIds.Count == 0)
        {
            return new Dictionary<Guid, decimal>();
        }

        Guid[] ids = [.. variantIds];
        try
        {
            // product_variants belongs to the Catalog module but lives in the same tenant schema.
            List<VariantCostRow> rows = await db.Database.SqlQuery<VariantCostRow>($"""
                SELECT id AS "VariantId", COALESCE(cost_price, 0) AS "CostPrice"
                FROM product_variants
                WHERE id = ANY({ids})
                """).ToListAsync(cancellationToken);

            return rows.ToDictionary(r => r.VariantId, r => r.CostPrice);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            // Catalog tables not created yet for this tenant: count without values.
            return new Dictionary<Guid, decimal>();
        }
    }
}

// Row shape for the raw query above; EF maps the result columns by property name.
internal sealed class VariantCostRow
{
    public Guid VariantId { get; set; }
    public decimal CostPrice { get; set; }
}
