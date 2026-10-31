using ReturnOrderEntity = NexusPOS.POS.Domain.Entities.ReturnOrder;

namespace NexusPOS.POS.Application.Common;

internal static class ReturnOrderMapper
{
    // lineCosts maps an original order line id to its unit cost.
    public static ReturnOrderResponse ToResponse(ReturnOrderEntity r, IReadOnlyDictionary<Guid, decimal> lineCosts) => new(
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
        r.Lines.Select(l => new ReturnOrderLineResponse(
            l.Id.Value,
            l.OriginalLineId,
            l.VariantId,
            l.ProductName,
            l.VariantName,
            l.Quantity,
            l.UnitPrice,
            l.LineTotal,
            l.Reason,
            lineCosts.GetValueOrDefault(l.OriginalLineId))).ToList());
}
