namespace NexusPOS.Inventory.Presentation.Requests;

public sealed record InitializeStockRequest(
    Guid VariantId,
    decimal ReorderPoint = 0,
    decimal ReorderQuantity = 0);
