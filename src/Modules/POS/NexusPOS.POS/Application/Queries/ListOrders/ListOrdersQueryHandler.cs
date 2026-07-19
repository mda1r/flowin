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
        IReadOnlyList<Order> orders = await orderRepository.FindByBranchAsync(
            request.BranchId,
            request.Status,
            request.From,
            request.To,
            request.Page,
            request.PageSize,
            cancellationToken: cancellationToken);

        return orders.Select(OrderMapper.ToResponse).ToList();
    }
}
