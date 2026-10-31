using ErrorOr;
using MediatR;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;

internal sealed class CreateRestaurantOrderCommandHandler(
    IRestaurantOrderRepository orderRepository,
    IMenuItemRepository menuItemRepository,
    IDiscountCodeRepository discountCodeRepository,
    RestaurantDbContext dbContext,
    ITenantContext tenantContext,
    IPublisher publisher)
    : ICommandHandler<CreateRestaurantOrderCommand, RestaurantOrderResponse>
{
    public async Task<ErrorOr<RestaurantOrderResponse>> Handle(
        CreateRestaurantOrderCommand request,
        CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Error.Unauthorized("Restaurant.NoTenant", "Tenant context is required.");
        }

        var linesResult = await MenuOrderLines.ResolveAsync(
            menuItemRepository, request.BranchId, request.Items, cancellationToken);
        if (linesResult.IsError)
        {
            return linesResult.Errors;
        }

        var lines = linesResult.Value;
        decimal discountAmount = 0m;
        DiscountCode? discountCode = null;

        if (!string.IsNullOrWhiteSpace(request.DiscountCode))
        {
            discountCode = await discountCodeRepository.FindByCodeAsync(
                tenantId, request.DiscountCode, cancellationToken);

            if (discountCode is null)
            {
                return RestaurantErrors.DiscountCodeNotFound;
            }

            decimal subTotal = lines.Sum(i => i.UnitPrice * i.Quantity);
            ErrorOr<Success> validation = discountCode.Validate(subTotal);
            if (validation.IsError)
            {
                return validation.Errors;
            }

            discountAmount = discountCode.ComputeDiscount(subTotal);
        }

        ErrorOr<RestaurantOrder> orderResult = RestaurantOrder.Create(
            tenantId,
            request.BranchId,
            request.TableNumber,
            lines,
            request.Notes,
            discountCode?.Code,
            discountAmount);

        if (orderResult.IsError)
        {
            return orderResult.Errors;
        }

        RestaurantOrder order = orderResult.Value;
        if (request.SendToKitchen || request.Payment is not null)
        {
            ErrorOr<Success> sent = order.SendToKitchen();
            if (sent.IsError)
            {
                return sent.Errors;
            }
        }

        if (request.Payment is not null)
        {
            HashSet<Guid> menuItemIds = [.. lines.Select(l => l.MenuItemId)];
            ErrorOr<Success> paid = await RestaurantPayment.PayAsync(
                order, request.Payment.PaymentMethod, request.Payment.AmountTendered, menuItemIds, publisher, cancellationToken);
            if (paid.IsError)
            {
                return paid.Errors;
            }
        }

        orderRepository.Add(order);

        if (discountCode is not null)
        {
            discountCode.IncrementUsage();
            discountCodeRepository.Update(discountCode);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantOrderMapper.ToResponse(order);
    }
}
