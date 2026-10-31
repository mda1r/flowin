using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.POS.Application.Common;

// CostPrice is the unit cost of the original sale line, so reports can put the returned goods back
// into stock value; it is 0 when the original line is gone or had no cost.
public sealed record ReturnOrderLineResponse(
    Guid Id,
    Guid OriginalLineId,
    Guid VariantId,
    string ProductName,
    string VariantName,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal,
    ReturnReason Reason,
    decimal CostPrice);

public sealed record ReturnOrderResponse(
    Guid Id,
    Guid OriginalOrderId,
    Guid TenantId,
    Guid BranchId,
    string Currency,
    decimal RefundAmount,
    decimal NetAmount,
    decimal TaxAmount,
    RefundMethod RefundMethod,
    DateTime CreatedAt,
    IReadOnlyList<ReturnOrderLineResponse> Lines,
    Guid? CreatedByUserId = null,
    string? CreatedByName = null,
    Guid? ShiftId = null,
    string? Note = null);
