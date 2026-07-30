namespace NexusPOS.Inventory.Presentation.Requests;

public sealed record SaveStockCountItemRequest(Guid StockItemId, decimal CountedQuantity);

public sealed record SaveStockCountItemsRequest(IReadOnlyList<SaveStockCountItemRequest> Items);
