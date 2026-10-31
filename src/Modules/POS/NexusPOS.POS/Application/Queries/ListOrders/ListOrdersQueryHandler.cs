using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListOrders;

internal sealed class ListOrdersQueryHandler(IOrderRepository orderRepository)
    : IQueryHandler<ListOrdersQuery, IReadOnlyList<OrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<OrderResponse>>> Handle(
        ListOrdersQuery request,
        CancellationToken cancellationToken)
    {
        // An invoice number is looked up across all dates: a customer may bring back last month's receipt.
        bool byNumber = request.Number.HasValue;
        IReadOnlyList<Order> orders = await orderRepository.FindByBranchAsync(
            request.BranchId,
            request.Status,
            byNumber ? null : request.From,
            byNumber ? null : request.To,
            request.Page,
            request.PageSize,
            request.Number,
            cancellationToken);

        return orders.Select(OrderMapper.ToResponse).ToList();
    }
}
