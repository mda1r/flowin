using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CancelRestaurantOrder;

public sealed record CancelRestaurantOrderCommand(Guid OrderId, Guid BranchId) : ICommand<RestaurantOrderResponse>;
