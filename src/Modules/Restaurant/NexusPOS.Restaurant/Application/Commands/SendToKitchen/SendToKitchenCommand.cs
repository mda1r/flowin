using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.SendToKitchen;

public sealed record SendToKitchenCommand(Guid OrderId, Guid BranchId) : ICommand<RestaurantOrderResponse>;
