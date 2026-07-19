using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListActiveOrders;

internal sealed class ListActiveOrdersQueryHandler(IRestaurantOrderRepository orderRepository)
    : IQueryHandler<ListActiveOrdersQuery, IReadOnlyList<RestaurantOrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<RestaurantOrderResponse>>> Handle(
        ListActiveOrdersQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<RestaurantOrder> orders =
            await orderRepository.FindActiveByBranchAsync(request.BranchId, cancellationToken);

        return orders.Select(RestaurantOrderMapper.ToResponse).ToList();
    }
}
