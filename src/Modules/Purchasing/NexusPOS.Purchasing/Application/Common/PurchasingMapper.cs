using NexusPOS.Purchasing.Domain.Entities;

namespace NexusPOS.Purchasing.Application.Common;

internal static class PurchasingMapper
{
    internal static SupplierResponse ToResponse(Supplier supplier) => new(
        supplier.Id.Value,
        supplier.TenantId,
        supplier.Name,
        supplier.ContactEmail,
        supplier.ContactPhone,
        supplier.Address,
        supplier.IsActive,
        supplier.CreatedAt);

    internal static PurchaseOrderResponse ToResponse(PurchaseOrder order) => new(
        order.Id.Value,
        order.TenantId,
        order.BranchId,
        order.SupplierId.Value,
        order.Status,
        order.TotalAmount,
        order.ExpectedDeliveryDate,
        order.Notes,
        order.CreatedAt,
        order.ReceivedAt,
        order.Lines.Select(l => new PurchaseOrderLineResponse(
            l.Id.Value,
            l.VariantId,
            l.Description,
            l.UnitCost,
            l.OrderedQuantity,
            l.ReceivedQuantity,
            l.LineTotal,
            l.IsFullyReceived)).ToList());
}
