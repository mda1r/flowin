namespace NexusPOS.Inventory.Application.Common;

public sealed record StockAlertItemResponse(
    Guid StockItemId,
    Guid VariantId,
    Guid BranchId,
    decimal Quantity,
    decimal ReorderPoint,
    DateTime? ExpiryDate,
    int? DaysUntilExpiry,
    string AlertType);

public sealed record InventoryAlertsResponse(
    IReadOnlyList<StockAlertItemResponse> Expired,
    IReadOnlyList<StockAlertItemResponse> ExpiringSoon,
    IReadOnlyList<StockAlertItemResponse> LowStock,
    int TotalAlerts);
