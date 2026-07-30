namespace NexusPOS.Inventory.Presentation.Requests;

public sealed record CompleteStockCountSessionRequest(bool AutoAdjust = false);
