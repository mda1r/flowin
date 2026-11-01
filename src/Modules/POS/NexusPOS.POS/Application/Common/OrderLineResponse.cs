namespace NexusPOS.POS.Application.Common;

// RefundUnitPrice is what one unit gives back on a return, VAT included: the price actually paid after every discount.
// Modifiers are the add-ons sold with the item (PriceDelta net, already inside UnitPrice); null when there were none.
public sealed record OrderLineResponse(
    Guid Id,
    Guid VariantId,
    string ProductName,
    string VariantName,
    decimal UnitPrice,
    decimal CostPrice,
    decimal Quantity,
    decimal LineSubtotal,
    decimal LineDiscountAmount,
    decimal LineTotal,
    string? Notes = null,
    decimal RefundUnitPrice = 0m,
    IReadOnlyList<OrderLineModifierResponse>? Modifiers = null);

public sealed record OrderLineModifierResponse(Guid Id, string Name, decimal PriceDelta);
