using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.ServeOrder;

public sealed record ServeOrderCommand(Guid OrderId, Guid BranchId) : ICommand<RestaurantOrderResponse>;
