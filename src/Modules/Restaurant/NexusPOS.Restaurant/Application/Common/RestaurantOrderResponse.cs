using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.Application.Common;

public sealed record RestaurantOrderResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    int TableNumber,
    RestaurantOrderStatus Status,
    string? Notes,
    string? AppliedDiscountCode,
    decimal DiscountAmount,
    decimal SubTotal,
    decimal TaxAmount,
    decimal Total,
    string? PaymentMethod,
    decimal? AmountTendered,
    DateTime CreatedAt,
    DateTime? ServedAt,
    DateTime? PaidAt,
    IReadOnlyList<RestaurantOrderItemResponse> Items);
