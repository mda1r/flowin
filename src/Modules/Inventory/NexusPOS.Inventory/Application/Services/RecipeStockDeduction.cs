using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Services;
using NexusPOS.Inventory.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.Services;

// Recipe lines are keyed by the sold item's id: a catalog variant for POS sales, a menu item for restaurant sales.
// Materials may go below zero so a sale is never dropped; that is logged so the shortfall can be traced.
internal static class RecipeStockDeduction
{
    public static async Task DeductAsync(
        InventoryDbContext db,
        Guid tenantId,
        Guid saleId,
        IReadOnlyCollection<(Guid ItemId, decimal Quantity)> soldLines,
        Guid? userId,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        List<Guid> itemIds = [.. soldLines.Select(l => l.ItemId).Distinct()];
        List<RecipeLine> recipeLines = await db.RecipeLines
            .Where(r => r.TenantId == tenantId && itemIds.Contains(r.VariantId))
            .ToListAsync(cancellationToken);
        if (recipeLines.Count == 0)
        {
            return;
        }

        Dictionary<Guid, decimal> consumed = RecipeConsumption.ComponentQuantities(recipeLines, soldLines);

        List<Guid> materialIds = [.. consumed.Keys];
        List<StockMaterial> materials = await db.StockMaterials
            .Where(m => m.TenantId == tenantId && materialIds.Contains(m.Id))
            .ToListAsync(cancellationToken);

        string note = $"بيع طلب #{saleId.ToString()[..8]}";
        foreach (StockMaterial material in materials)
        {
            decimal before = material.CurrentQuantityInStorageUnits;
            material.Consume(consumed[material.Id]);
            if (material.CurrentQuantityInStorageUnits < 0)
            {
                logger.LogWarning(
                    "Sale {SaleId} took material {MaterialId} below zero ({Before} -> {After} {Unit})",
                    saleId, material.Id, before, material.CurrentQuantityInStorageUnits, material.StorageUnit);
            }
            db.StockMaterialMovements.Add(StockMaterialMovement.Record(
                material, StockMaterialMovementType.Consumption,
                material.CurrentQuantityInStorageUnits - before, material.CurrentCost, note, userId));
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
