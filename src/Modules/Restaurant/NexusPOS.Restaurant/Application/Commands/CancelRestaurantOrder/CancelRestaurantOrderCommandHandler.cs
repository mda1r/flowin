using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CancelRestaurantOrder;

internal sealed class CancelRestaurantOrderCommandHandler(
    IRestaurantOrderRepository orderRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<CancelRestaurantOrderCommand, RestaurantOrderResponse>
{
    public async Task<ErrorOr<RestaurantOrderResponse>> Handle(
        CancelRestaurantOrderCommand request,
        CancellationToken cancellationToken)
    {
        RestaurantOrder? order = await orderRepository.FindByIdAsync(
            new RestaurantOrderId(request.OrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return RestaurantErrors.OrderNotFound;
        }

        ErrorOr<Success> result = order.Cancel();
        if (result.IsError)
        {
            return result.Errors;
        }

        orderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantOrderMapper.ToResponse(order);
    }
}
