using NexusPOS.POS.Domain.Entities;

namespace NexusPOS.POS.Application.Common;

internal static class OrderMapper
{
    internal static OrderResponse ToResponse(Order order)
    {
        return new OrderResponse(
            order.Id.Value,
            order.TenantId,
            order.BranchId,
            order.CustomerId,
            order.Currency,
            order.Status,
            order.SubtotalAmount,
            order.DiscountAmount,
            order.TaxAmount,
            order.TotalAmount,
            order.TaxRate,
            order.PaymentMethod,
            order.AmountTendered,
            order.ChangeDue,
            order.Notes,
            order.CreatedAt,
            order.CompletedAt,
            order.Lines.Select(l => new OrderLineResponse(
                l.Id.Value,
                l.VariantId,
                l.ProductName,
                l.VariantName,
                l.UnitPrice.Amount,
                l.Quantity,
                l.LineSubtotal,
                l.LineDiscountAmount,
                l.LineTotal)).ToList());
    }
}
