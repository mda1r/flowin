using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.CancelOrder;

public sealed record CancelOrderCommand(
    Guid OrderId,
    Guid BranchId,
    string? Reason = null) : ICommand<OrderResponse>;
