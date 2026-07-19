using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.Application.Common;

public sealed record RestaurantOrderItemResponse(
    Guid Id,
    Guid MenuItemId,
    string ItemName,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal,
    string? Notes,
    OrderItemStatus Status);
