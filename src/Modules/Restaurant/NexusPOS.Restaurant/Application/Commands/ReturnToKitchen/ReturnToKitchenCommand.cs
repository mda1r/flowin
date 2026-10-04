using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.ReturnToKitchen;

public sealed record ReturnToKitchenCommand(Guid OrderId, Guid BranchId) : ICommand<RestaurantOrderResponse>;
