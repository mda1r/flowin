using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.AddOrderLine;

public sealed record AddOrderLineCommand(
    Guid OrderId,
    Guid BranchId,
    Guid VariantId,
    string ProductName,
    string VariantName,
    decimal UnitPrice,
    decimal Quantity) : ICommand<OrderResponse>;
