using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.RemoveOrderItem;

internal sealed class RemoveOrderItemCommandHandler(
    IRestaurantOrderRepository orderRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<RemoveOrderItemCommand, RestaurantOrderResponse>
{
    public async Task<ErrorOr<RestaurantOrderResponse>> Handle(
        RemoveOrderItemCommand request,
        CancellationToken cancellationToken)
    {
        RestaurantOrder? order = await orderRepository.FindByIdAsync(
            new RestaurantOrderId(request.OrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return RestaurantErrors.OrderNotFound;
        }

        ErrorOr<RestaurantOrderItem> removed = order.RemoveItem(new RestaurantOrderItemId(request.ItemId));
        if (removed.IsError)
        {
            return removed.Errors;
        }

        dbContext.RestaurantOrderItems.Remove(removed.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantOrderMapper.ToResponse(order);
    }
}
