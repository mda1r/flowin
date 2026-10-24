namespace NexusPOS.Inventory.Application.Common;

public sealed record RecipeLineResponse(
    Guid MaterialId,
    string MaterialName,
    string ComponentUnit,
    decimal Quantity,
    decimal CostPerComponentUnit,
    decimal LineCost);

public sealed record RecipeResponse(Guid VariantId, IReadOnlyList<RecipeLineResponse> Lines, decimal TotalCost);

public sealed record RecipeSummaryResponse(Guid VariantId, int LineCount, decimal TotalCost);
