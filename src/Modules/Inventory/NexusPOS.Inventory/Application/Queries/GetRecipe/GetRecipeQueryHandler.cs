using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Services;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetRecipe;

internal sealed class GetRecipeQueryHandler(InventoryDbContext db) : IQueryHandler<GetRecipeQuery, RecipeResponse>
{
    public async Task<ErrorOr<RecipeResponse>> Handle(GetRecipeQuery request, CancellationToken cancellationToken)
        => await Load(db, request.TenantId, request.VariantId, cancellationToken);

    internal static async Task<RecipeResponse> Load(InventoryDbContext db, Guid tenantId, Guid variantId, CancellationToken ct)
    {
        var rows = await db.RecipeLines
            .Where(r => r.TenantId == tenantId && r.VariantId == variantId)
            .Join(db.StockMaterials, r => r.MaterialId, m => m.Id, (r, m) => new { Line = r, Material = m })
            .OrderBy(x => x.Line.CreatedAt)
            .ToListAsync(ct);

        List<RecipeLineResponse> lines = rows
            .Select(x => new RecipeLineResponse(
                x.Material.Id, x.Material.NameAr, x.Material.ComponentUnit, x.Line.Quantity,
                x.Material.CostPerComponentUnit,
                RecipeCosting.LineCost(x.Line.Quantity, x.Material.CurrentCost, x.Material.ConversionFactor)))
            .ToList();

        return new RecipeResponse(variantId, lines, RecipeCosting.Total(lines.Select(l => l.LineCost)));
    }
}
