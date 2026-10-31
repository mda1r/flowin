using ErrorOr;
using MediatR;
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
    RestaurantDbContext dbContext,
    IPublisher publisher)
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

        HashSet<Guid> menuItemIds = await RestaurantPayment.MenuItemIdsAsync(dbContext, [order], cancellationToken);

        var sales = RestaurantPayment.Pay(order, request.PaymentMethod, request.AmountTendered, menuItemIds);
        if (sales.IsError)
        {
            return sales.Errors;
        }

        ErrorOr<Success> saved = await RestaurantSave.SaveWithSalesAsync(
            dbContext, sales.Value, publisher, RestaurantErrors.OrderChanged, cancellationToken);
        if (saved.IsError)
        {
            return saved.Errors;
        }

        return RestaurantOrderMapper.ToResponse(order);
    }
}
