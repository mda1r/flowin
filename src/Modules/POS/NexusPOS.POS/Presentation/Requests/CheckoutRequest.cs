using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Presentation.Requests;

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
    DateTime? OfflineCreatedAt = null);

public sealed record CheckoutLineRequest(
    Guid VariantId, string ProductName, string VariantName, decimal UnitPrice, decimal CostPrice, decimal Quantity);
