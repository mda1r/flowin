using NexusPOS.SharedKernel.Application.Services;
using ErrorOr;
using MediatR;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Domain.Events;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;

internal sealed class CreateRestaurantOrderCommandHandler(
    IRestaurantOrderRepository orderRepository,
    IMenuItemRepository menuItemRepository,
    IDiscountCodeRepository discountCodeRepository,
    RestaurantDbContext dbContext,
    ITenantContext tenantContext,
    IPublisher publisher,
    ITenantVatPolicy vatPolicy)
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

        if (request.OrderId is Guid orderId)
        {
            RestaurantOrder? existing = await orderRepository.FindByIdAsync(new RestaurantOrderId(orderId), cancellationToken);
            if (existing is not null)
            {
                return existing.BranchId == request.BranchId && !existing.KitchenOnly
                    ? RestaurantOrderMapper.ToResponse(existing)
                    : RestaurantErrors.OrderIdTaken;
            }
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
            discountAmount,
            id: request.OrderId,
            taxRate: Vat.RateFor(await vatPolicy.IsVatEnabledAsync(tenantId, cancellationToken)));

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

        IReadOnlyList<ExternalSaleCompletedDomainEvent> sales = [];
        if (request.Payment is not null)
        {
            HashSet<Guid> menuItemIds = [.. lines.Select(l => l.MenuItemId)];
            var paid = RestaurantPayment.Pay(order, request.Payment.PaymentMethod, request.Payment.AmountTendered, menuItemIds);
            if (paid.IsError)
            {
                return paid.Errors;
            }

            sales = paid.Value;
        }

        orderRepository.Add(order);

        if (discountCode is not null)
        {
            discountCode.IncrementUsage();
            discountCodeRepository.Update(discountCode);
        }

        // The order is written before its sale is recorded, and committed only once the sale is, so a failure
        // leaves neither behind; a retry with the same OrderId is recorded once.
        ErrorOr<Success> saved = await RestaurantSave.SaveWithSalesAsync(
            dbContext, sales, publisher, RestaurantErrors.OrderChanged, cancellationToken);
        if (saved.IsError)
        {
            return saved.Errors;
        }

        return RestaurantOrderMapper.ToResponse(order);
    }
}
