using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;

public sealed record OrderItemInput(
    Guid MenuItemId,
    string ItemName,
    int Quantity,
    decimal UnitPrice,
    string? Notes);

public sealed record CreateRestaurantOrderCommand(
    Guid TenantId,
    Guid BranchId,
    int TableNumber,
    IReadOnlyList<OrderItemInput> Items,
    string? Notes,
    string? DiscountCode) : ICommand<RestaurantOrderResponse>;
