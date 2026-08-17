using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Application.Common;

public sealed record OrderResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    Guid? CustomerId,
    string Currency,
    OrderStatus Status,
    decimal SubtotalAmount,
    decimal DiscountAmount,
    decimal TaxAmount,
    decimal TotalAmount,
    decimal TaxRate,
    PaymentMethod? PaymentMethod,
    decimal? AmountTendered,
    decimal? ChangeDue,
    decimal? SplitCash,
    decimal? SplitCard,
    string? Notes,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    IReadOnlyList<OrderLineResponse> Lines);
