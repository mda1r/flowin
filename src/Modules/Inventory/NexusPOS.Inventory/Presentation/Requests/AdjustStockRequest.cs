namespace NexusPOS.Inventory.Presentation.Requests;

public sealed record AdjustStockRequest(
    decimal NewQuantity,
    string? Reference = null,
    string? Notes = null);
