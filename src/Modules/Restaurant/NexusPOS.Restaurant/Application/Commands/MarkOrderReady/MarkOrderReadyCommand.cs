using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.MarkOrderReady;

public sealed record MarkOrderReadyCommand(Guid OrderId, Guid BranchId) : ICommand<RestaurantOrderResponse>;
