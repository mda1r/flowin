using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;

internal sealed class CreateRestaurantOrderCommandHandler(
    IRestaurantOrderRepository orderRepository,
    IDiscountCodeRepository discountCodeRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<CreateRestaurantOrderCommand, RestaurantOrderResponse>
{
    public async Task<ErrorOr<RestaurantOrderResponse>> Handle(
        CreateRestaurantOrderCommand request,
        CancellationToken cancellationToken)
    {
        decimal discountAmount = 0m;
        DiscountCode? discountCode = null;

        if (!string.IsNullOrWhiteSpace(request.DiscountCode))
        {
            discountCode = await discountCodeRepository.FindByCodeAsync(
                request.TenantId, request.DiscountCode, cancellationToken);

            if (discountCode is null)
            {
                return RestaurantErrors.DiscountCodeNotFound;
            }

            decimal subTotal = request.Items.Sum(i => i.UnitPrice * i.Quantity);
            ErrorOr<Success> validation = discountCode.Validate(subTotal);
            if (validation.IsError)
            {
                return validation.Errors;
            }

            discountAmount = discountCode.ComputeDiscount(subTotal);
        }

        var itemsData = request.Items
            .Select(i => (i.MenuItemId, i.ItemName, i.Quantity, i.UnitPrice, i.Notes))
            .ToList();

        ErrorOr<RestaurantOrder> orderResult = RestaurantOrder.Create(
            request.TenantId,
            request.BranchId,
            request.TableNumber,
            itemsData,
            request.Notes,
            request.DiscountCode,
            discountAmount);

        if (orderResult.IsError)
        {
            return orderResult.Errors;
        }

        RestaurantOrder order = orderResult.Value;
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
