namespace NexusPOS.Inventory.Presentation.Requests;

// The server snapshots the branch's stock itself; any item list sent by an older client is ignored.
public sealed record CreateStockCountSessionRequest(
    string Type,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    string? Notes);
