using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.PayOrder;

public sealed record PayOrderCommand(
    Guid OrderId,
    Guid BranchId,
    string PaymentMethod,
    decimal AmountTendered) : ICommand<RestaurantOrderResponse>;
