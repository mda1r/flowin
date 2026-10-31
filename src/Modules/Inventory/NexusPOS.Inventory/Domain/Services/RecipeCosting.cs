namespace NexusPOS.Inventory.Domain.Services;

// The one cost formula for a recipe, shared by the recipe screens and the till so the two never drift.
// A material's CurrentCost is per storage unit (a 1 kg bag); a recipe line is in component units (18 g),
// and ConversionFactor is how many component units one storage unit holds.
public static class RecipeCosting
{
    // Net cost of one recipe line; a material with no conversion factor has no known cost yet.
    public static decimal LineCost(decimal quantity, decimal currentCost, decimal conversionFactor) =>
        conversionFactor > 0 ? Math.Round(quantity * currentCost / conversionFactor, 4) : 0m;

    // Net cost of one unit of the product: its lines added up.
    public static decimal Total(IEnumerable<decimal> lineCosts) => Math.Round(lineCosts.Sum(), 4);
}
