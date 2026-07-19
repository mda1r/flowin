namespace NexusPOS.POS.Presentation.Requests;

public sealed record AddOrderLineRequest(
    Guid VariantId,
    string ProductName,
    string VariantName,
    decimal UnitPrice,
    decimal Quantity);
