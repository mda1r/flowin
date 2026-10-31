using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Queries.ListPurchaseOrders;

internal sealed class ListPurchaseOrdersQueryHandler(
    IPurchaseOrderRepository purchaseOrderRepository,
    ISupplierRepository supplierRepository)
    : IQueryHandler<ListPurchaseOrdersQuery, IReadOnlyList<PurchaseOrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<PurchaseOrderResponse>>> Handle(
        ListPurchaseOrdersQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Domain.Entities.PurchaseOrder> orders = await purchaseOrderRepository.FindByBranchAsync(
            request.BranchId, request.Status, request.SupplierId, request.Page, request.PageSize, cancellationToken);

        IReadOnlyDictionary<Guid, string> names = await supplierRepository.FindNamesAsync(
            orders.Select(o => o.SupplierId.Value).Distinct().ToList(), cancellationToken);

        return orders
            .Select(o => PurchasingMapper.ToResponse(o, names.GetValueOrDefault(o.SupplierId.Value)))
            .ToList();
    }
}
