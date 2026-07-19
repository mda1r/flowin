using ErrorOr;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Queries.ListPurchaseOrders;

internal sealed class ListPurchaseOrdersQueryHandler(IPurchaseOrderRepository purchaseOrderRepository)
    : IQueryHandler<ListPurchaseOrdersQuery, IReadOnlyList<PurchaseOrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<PurchaseOrderResponse>>> Handle(
        ListPurchaseOrdersQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Domain.Entities.PurchaseOrder> orders = await purchaseOrderRepository.FindByBranchAsync(
            request.BranchId, request.Status, request.SupplierId, request.Page, request.PageSize, cancellationToken);

        return orders.Select(PurchasingMapper.ToResponse).ToList();
    }
}
