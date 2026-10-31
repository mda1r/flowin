using ErrorOr;
using MediatR;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.PayTable;

internal sealed class PayTableCommandHandler(
    IRestaurantOrderRepository orderRepository,
    RestaurantDbContext dbContext,
    IPublisher publisher)
    : ICommandHandler<PayTableCommand, IReadOnlyList<RestaurantOrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<RestaurantOrderResponse>>> Handle(
        PayTableCommand request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<RestaurantOrder> orders = await orderRepository.FindOpenByTableAsync(
            request.BranchId, request.TableNumber, cancellationToken);

        if (orders.Count == 0)
        {
            return RestaurantErrors.OrderNotFound;
        }

        if (!orders.Select(o => o.Id.Value).ToHashSet().SetEquals(request.OrderIds))
        {
            return RestaurantErrors.TableChanged;
        }

        List<decimal> totals = [.. orders.Select(o => o.Total)];
        if (request.AmountTendered < totals.Sum())
        {
            return RestaurantErrors.InsufficientPayment;
        }

        HashSet<Guid> menuItemIds = await RestaurantPayment.MenuItemIdsAsync(dbContext, orders, cancellationToken);
        IReadOnlyList<decimal> tendered = RestaurantPayment.SplitTender(totals, request.AmountTendered);

        // One sale per order, so each keeps its own invoice; the orders are saved together once all are paid.
        for (int i = 0; i < orders.Count; i++)
        {
            ErrorOr<Success> result = await RestaurantPayment.PayAsync(
                orders[i], request.PaymentMethod, tendered[i], menuItemIds, publisher, cancellationToken);
            if (result.IsError)
            {
                return result.Errors;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return orders.Select(RestaurantOrderMapper.ToResponse).ToList();
    }
}
