namespace NexusPOS.Inventory.Application.Common;

public sealed record StockMaterialCategoryResponse(
    Guid Id,
    string Name,
    bool IsActive);
