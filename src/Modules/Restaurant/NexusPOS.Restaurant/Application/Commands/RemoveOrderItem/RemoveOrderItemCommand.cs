using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.RemoveOrderItem;

public sealed record RemoveOrderItemCommand(Guid OrderId, Guid ItemId, Guid BranchId) : ICommand<RestaurantOrderResponse>;
