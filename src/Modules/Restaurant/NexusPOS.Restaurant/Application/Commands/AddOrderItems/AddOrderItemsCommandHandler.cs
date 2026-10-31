using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.AddOrderItems;

internal sealed class AddOrderItemsCommandHandler(
    IRestaurantOrderRepository orderRepository,
    IMenuItemRepository menuItemRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<AddOrderItemsCommand, RestaurantOrderResponse>
{
    public async Task<ErrorOr<RestaurantOrderResponse>> Handle(
        AddOrderItemsCommand request,
        CancellationToken cancellationToken)
    {
        RestaurantOrder? order = await orderRepository.FindByIdAsync(
            new RestaurantOrderId(request.OrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return RestaurantErrors.OrderNotFound;
        }

        var lines = await MenuOrderLines.ResolveAsync(
            menuItemRepository, request.BranchId, request.Items, cancellationToken);
        if (lines.IsError)
        {
            return lines.Errors;
        }

        ErrorOr<IReadOnlyList<RestaurantOrderItem>> added = order.AddItems(lines.Value);
        if (added.IsError)
        {
            return added.Errors;
        }

        if (request.SendToKitchen && order.Status == RestaurantOrderStatus.Pending)
        {
            ErrorOr<Success> sent = order.SendToKitchen();
            if (sent.IsError)
            {
                return sent.Errors;
            }
        }

        // The order is tracked; the new lines are added explicitly so they are inserted, not updated. If the
        // order was paid or changed since it was read, the save fails rather than add a round to a settled bill.
        dbContext.RestaurantOrderItems.AddRange(added.Value);
        ErrorOr<Success> saved = await RestaurantSave.SaveAsync(dbContext, RestaurantErrors.OrderChanged, cancellationToken);
        if (saved.IsError)
        {
            return saved.Errors;
        }

        return RestaurantOrderMapper.ToResponse(order);
    }
}
