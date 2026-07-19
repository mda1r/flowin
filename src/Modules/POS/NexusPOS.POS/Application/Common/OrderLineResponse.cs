namespace NexusPOS.POS.Application.Common;

public sealed record OrderLineResponse(
    Guid Id,
    Guid VariantId,
    string ProductName,
    string VariantName,
    decimal UnitPrice,
    decimal Quantity,
    decimal LineSubtotal,
    decimal LineDiscountAmount,
    decimal LineTotal);
