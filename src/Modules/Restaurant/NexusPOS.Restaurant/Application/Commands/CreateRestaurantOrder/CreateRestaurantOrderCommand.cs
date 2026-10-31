using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;

// Names and prices come from the menu, never from the request.
public sealed record OrderItemInput(
    Guid MenuItemId,
    int Quantity,
    string? Notes);

public sealed record OrderPaymentInput(string PaymentMethod, decimal AmountTendered);

// SendToKitchen and Payment let a till open, send and settle an order in one call, so a retry after a
// failure never leaves a half-made order behind. A payment implies sending to the kitchen. OrderId is the
// till's own id for the order: a call resent with it returns the order the first call made, never a second one.
public sealed record CreateRestaurantOrderCommand(
    Guid BranchId,
    int TableNumber,
    IReadOnlyList<OrderItemInput> Items,
    string? Notes,
    string? DiscountCode,
    bool SendToKitchen = false,
    OrderPaymentInput? Payment = null,
    Guid? OrderId = null) : ICommand<RestaurantOrderResponse>;
