using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.PayOrder;

internal sealed class PayOrderCommandHandler(
    IRestaurantOrderRepository orderRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<PayOrderCommand, RestaurantOrderResponse>
{
    public async Task<ErrorOr<RestaurantOrderResponse>> Handle(
        PayOrderCommand request,
        CancellationToken cancellationToken)
    {
        RestaurantOrder? order = await orderRepository.FindByIdAsync(
            new RestaurantOrderId(request.OrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return RestaurantErrors.OrderNotFound;
        }

        ErrorOr<Success> result = order.Pay(request.PaymentMethod, request.AmountTendered);
        if (result.IsError)
        {
            return result.Errors;
        }

        orderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantOrderMapper.ToResponse(order);
    }
}
