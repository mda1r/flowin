using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Presentation.Requests;

// Discounts use the same pre-VAT figures as the line prices: a Fixed value is net riyals, a Percentage is 0–100.
// ApprovalPin is the branch manager PIN, needed only when a cashier's discount goes past the branch cap.
public sealed record CheckoutRequest(
    Guid ClientReference,
    string Currency,
    decimal TaxRate,
    Guid? CustomerId,
    IReadOnlyList<CheckoutLineRequest> Lines,
    int LoyaltyPoints,
    PaymentMethod PaymentMethod,
    decimal AmountTendered,
    decimal? CashAmount = null,
    decimal? CardAmount = null,
    DateTime? OfflineCreatedAt = null,
    DiscountType DiscountType = DiscountType.None,
    decimal DiscountValue = 0m,
    string? ApprovalPin = null,
    CheckoutKitchenRequest? Kitchen = null);

public sealed record CheckoutLineRequest(
    Guid VariantId, string ProductName, string VariantName, decimal UnitPrice, decimal CostPrice, decimal Quantity,
    DiscountType DiscountType = DiscountType.None, decimal DiscountValue = 0m, string? Notes = null);

// Sends the sale to the kitchen screen; no table number means takeaway or a guest without a table.
public sealed record CheckoutKitchenRequest(int? TableNumber, bool Takeaway);
