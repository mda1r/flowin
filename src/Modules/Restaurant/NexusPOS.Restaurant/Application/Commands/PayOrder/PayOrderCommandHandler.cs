using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Domain.Events;

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

        List<MenuItemId> itemIds = [.. order.Items.Select(i => new MenuItemId(i.MenuItemId)).Distinct()];
        HashSet<Guid> menuItemIds = [.. await dbContext.MenuItems
            .Where(m => itemIds.Contains(m.Id))
            .Select(m => m.Id.Value)
            .ToListAsync(cancellationToken)];

        ErrorOr<Success> result = order.Pay(request.PaymentMethod, request.AmountTendered, menuItemIds);
        if (result.IsError)
        {
            return result.Errors;
        }

        // Kitchen copies of cafe sales hold no real menu items and were already sold at the cafe till.
        if (menuItemIds.Count > 0)
        {
            // The sale is recorded with prices before VAT. Orders opened before menu prices became
            // VAT-inclusive added VAT on top; their own totals tell which rule they were priced with.
            bool vatInclusive = Math.Abs(order.Total - (order.SubTotal - order.DiscountAmount)) < 0.01m;
            decimal toNet = vatInclusive ? 1 + RestaurantOrder.VatRate : 1m;
            await publisher.Publish(new ExternalSaleCompletedDomainEvent(
                order.TenantId,
                order.BranchId,
                ExternalSaleCompletedDomainEvent.Restaurant,
                order.Id.Value,
                [.. order.Items.Select(i => new ExternalSaleCompletedDomainEvent.Line(
                    i.MenuItemId, i.ItemName, Math.Round(i.UnitPrice / toNet, 4), i.Quantity))],
                Math.Round(order.DiscountAmount / toNet, 4),
                RestaurantOrder.VatRate,
                request.PaymentMethod,
                request.AmountTendered), cancellationToken);
        }

        orderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantOrderMapper.ToResponse(order);
    }
}
