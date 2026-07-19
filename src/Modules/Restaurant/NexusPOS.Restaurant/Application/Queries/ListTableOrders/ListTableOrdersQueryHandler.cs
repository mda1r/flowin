using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListTableOrders;

internal sealed class ListTableOrdersQueryHandler(IRestaurantOrderRepository orderRepository)
    : IQueryHandler<ListTableOrdersQuery, IReadOnlyList<RestaurantOrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<RestaurantOrderResponse>>> Handle(
        ListTableOrdersQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<RestaurantOrder> orders =
            await orderRepository.FindByTableAsync(request.BranchId, request.TableNumber, cancellationToken);

        return orders.Select(RestaurantOrderMapper.ToResponse).ToList();
    }
}
