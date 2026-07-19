using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.RemoveOrderLine;

public sealed record RemoveOrderLineCommand(
    Guid OrderId,
    Guid BranchId,
    Guid OrderLineId) : ICommand<OrderResponse>;
