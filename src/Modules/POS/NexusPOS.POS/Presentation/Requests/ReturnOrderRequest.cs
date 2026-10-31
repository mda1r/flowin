using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Presentation.Requests;

public sealed record ReturnOrderLineRequest(
    Guid LineId,
    decimal Quantity,
    ReturnReason Reason);

public sealed record ReturnOrderRequest(
    RefundMethod RefundMethod,
    IReadOnlyList<ReturnOrderLineRequest> Lines,
    bool RestockItems = true);
