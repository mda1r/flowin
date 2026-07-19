namespace NexusPOS.Inventory.Presentation.Requests;

public sealed record ReceiveStockRequest(
    decimal Quantity,
    string? Reference = null,
    string? Notes = null,
    DateTime? ExpiryDate = null);
