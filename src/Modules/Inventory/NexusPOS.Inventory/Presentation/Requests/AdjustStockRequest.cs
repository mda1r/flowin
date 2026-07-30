namespace NexusPOS.Inventory.Presentation.Requests;

public sealed record AdjustStockRequest(
    decimal NewQuantity,
    string? Reference = null,
    string? Notes = null,
    DateTime? ExpiryDate = null,
    decimal? ReorderPoint = null,
    decimal? ReorderQuantity = null);
