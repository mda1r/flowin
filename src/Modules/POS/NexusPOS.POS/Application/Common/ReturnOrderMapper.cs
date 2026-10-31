using NexusPOS.POS.Domain.Entities;

namespace NexusPOS.POS.Application.Common;

internal static class ReturnOrderMapper
{
    internal static ReturnOrderResponse ToResponse(ReturnOrder r) => new(
        r.Id.Value,
        r.OriginalOrderId,
        r.TenantId,
        r.BranchId,
        r.Currency,
        r.RefundAmount,
        r.RefundMethod,
        r.CreatedAt,
        [.. r.Lines.Select(l => new ReturnOrderLineResponse(
            l.Id.Value,
            l.OriginalLineId,
            l.VariantId,
            l.ProductName,
            l.VariantName,
            l.Quantity,
            l.UnitPrice,
            l.LineTotal,
            l.Reason))],
        r.CreatedByUserId,
        r.CreatedByName,
        r.ShiftId,
        r.Note);
}
