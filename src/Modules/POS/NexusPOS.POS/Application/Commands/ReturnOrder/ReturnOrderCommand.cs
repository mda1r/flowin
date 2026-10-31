using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.ReturnOrder;

public sealed record ReturnOrderLineInput(
    Guid LineId,
    decimal Quantity,
    ReturnReason Reason);

public sealed record ReturnOrderCommand(
    Guid OriginalOrderId,
    Guid BranchId,
    RefundMethod RefundMethod,
    IReadOnlyList<ReturnOrderLineInput> Lines,
    bool RestockItems = true,
    Guid? UserId = null,
    string? UserName = null,
    string? Note = null,
    Guid? ClientReference = null) : ICommand<ReturnOrderResponse>;
