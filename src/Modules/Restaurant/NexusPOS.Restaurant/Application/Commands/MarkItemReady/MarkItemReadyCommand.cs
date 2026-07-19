using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.MarkItemReady;

public sealed record MarkItemReadyCommand(
    Guid OrderId,
    Guid ItemId,
    Guid BranchId) : ICommand<RestaurantOrderResponse>;
