namespace NexusPOS.Inventory.Presentation.Requests;

public sealed record CreateStockCountSessionItemRequest(
    Guid StockItemId,
    Guid VariantId,
    decimal SystemQuantity,
    decimal UnitCost);

public sealed record CreateStockCountSessionRequest(
    string Type,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    string? Notes,
    IReadOnlyList<CreateStockCountSessionItemRequest> Items);
