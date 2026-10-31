using ErrorOr;
using MediatR;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Domain.Events;

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
        // A round added or voided after the orders were read here fails the save, so the bill is never short.
        List<ExternalSaleCompletedDomainEvent> sales = [];
        for (int i = 0; i < orders.Count; i++)
        {
            var paid = RestaurantPayment.Pay(orders[i], request.PaymentMethod, tendered[i], menuItemIds);
            if (paid.IsError)
            {
                return paid.Errors;
            }

            sales.AddRange(paid.Value);
        }

        ErrorOr<Success> saved = await RestaurantSave.SaveWithSalesAsync(
            dbContext, sales, publisher, RestaurantErrors.TableChanged, cancellationToken);
        if (saved.IsError)
        {
            return saved.Errors;
        }

        return orders.Select(RestaurantOrderMapper.ToResponse).ToList();
    }
}
