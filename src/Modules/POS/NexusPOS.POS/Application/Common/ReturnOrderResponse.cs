using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Application.Common;

public sealed record ReturnOrderLineResponse(
    Guid Id,
    Guid OriginalLineId,
    Guid VariantId,
    string ProductName,
    string VariantName,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal,
    ReturnReason Reason);

public sealed record ReturnOrderResponse(
    Guid Id,
    Guid OriginalOrderId,
    Guid TenantId,
    Guid BranchId,
    string Currency,
    decimal RefundAmount,
    RefundMethod RefundMethod,
    DateTime CreatedAt,
    IReadOnlyList<ReturnOrderLineResponse> Lines);
