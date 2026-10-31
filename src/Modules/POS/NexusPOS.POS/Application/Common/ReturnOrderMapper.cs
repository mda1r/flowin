using NexusPOS.POS.Domain.Entities;

namespace NexusPOS.POS.Application.Common;

internal static class ReturnOrderMapper
{
    // lineCosts maps an original order line id to its unit cost; lines it does not know report a cost of 0.
    internal static ReturnOrderResponse ToResponse(ReturnOrder r, IReadOnlyDictionary<Guid, decimal>? lineCosts = null) => new(
        r.Id.Value,
        r.OriginalOrderId,
        r.TenantId,
        r.BranchId,
        r.Currency,
        r.RefundAmount,
        r.NetAmount,
        r.TaxAmount,
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
            l.Reason,
            lineCosts?.GetValueOrDefault(l.OriginalLineId) ?? 0m))],
        r.CreatedByUserId,
        r.CreatedByName,
        r.ShiftId,
        r.Note);
}
