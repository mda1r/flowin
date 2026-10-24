using NexusPOS.Inventory.Domain.Entities;

namespace NexusPOS.Inventory.Domain.Services;

public static class RecipeConsumption
{
    // Total component-unit quantity of each material consumed by the sold lines.
    public static Dictionary<Guid, decimal> ComponentQuantities(
        IEnumerable<RecipeLine> recipeLines,
        IEnumerable<(Guid VariantId, decimal Quantity)> soldLines)
    {
        ILookup<Guid, RecipeLine> byVariant = recipeLines.ToLookup(r => r.VariantId);
        Dictionary<Guid, decimal> totals = [];

        foreach ((Guid variantId, decimal sold) in soldLines)
        {
            if (sold <= 0)
            {
                continue;
            }

            foreach (RecipeLine line in byVariant[variantId])
            {
                totals[line.MaterialId] = totals.GetValueOrDefault(line.MaterialId) + (line.Quantity * sold);
            }
        }

        return totals;
    }
}
