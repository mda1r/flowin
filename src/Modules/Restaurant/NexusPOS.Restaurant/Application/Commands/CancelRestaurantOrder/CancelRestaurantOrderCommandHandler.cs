using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.Application.Commands.CancelRestaurantOrder;

internal sealed class CancelRestaurantOrderCommandHandler(
    IRestaurantOrderRepository orderRepository,
    IDiscountCodeRepository discountCodeRepository,
    RestaurantDbContext dbContext,
    ITenantContext tenantContext)
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

        ErrorOr<Success> result = order.Cancel(request.Reason, tenantContext.UserId);
        if (result.IsError)
        {
            return result.Errors;
        }

        // The order never went through, so its discount code gets the use back.
        if (order.AppliedDiscountCode is not null)
        {
            DiscountCode? code = await discountCodeRepository.FindByCodeAsync(
                order.TenantId, order.AppliedDiscountCode, cancellationToken);
            if (code is not null)
            {
                code.DecrementUsage();
                discountCodeRepository.Update(code);
            }
        }

        // Refused if the order was paid or changed meanwhile, so a paid bill is never marked cancelled.
        orderRepository.Update(order);
        ErrorOr<Success> saved = await RestaurantSave.SaveAsync(dbContext, RestaurantErrors.OrderChanged, cancellationToken);
        if (saved.IsError)
        {
            return saved.Errors;
        }

        return RestaurantOrderMapper.ToResponse(order);
    }
}
