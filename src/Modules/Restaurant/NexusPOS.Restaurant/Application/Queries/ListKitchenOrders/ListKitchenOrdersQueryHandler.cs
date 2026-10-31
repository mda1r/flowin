using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListKitchenOrders;

internal sealed class ListKitchenOrdersQueryHandler(IRestaurantOrderRepository orderRepository)
    : IQueryHandler<ListKitchenOrdersQuery, IReadOnlyList<RestaurantOrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<RestaurantOrderResponse>>> Handle(
        ListKitchenOrdersQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<RestaurantOrder> orders = await orderRepository.FindKitchenByBranchAsync(
            request.BranchId, DateTime.UtcNow - RestaurantOrderQueries.LookBack, cancellationToken);

        return orders.Select(RestaurantOrderMapper.ToResponse).ToList();
    }
}
