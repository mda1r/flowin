using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.Application.Commands.CreateKitchenCopy;

internal sealed class CreateKitchenCopyCommandHandler(
    IRestaurantOrderRepository orderRepository,
    IMenuItemRepository menuItemRepository,
    RestaurantDbContext dbContext,
    ITenantContext tenantContext)
    : ICommandHandler<CreateKitchenCopyCommand, RestaurantOrderResponse>
{
    public async Task<ErrorOr<RestaurantOrderResponse>> Handle(
        CreateKitchenCopyCommand request,
        CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Error.Unauthorized("Restaurant.NoTenant", "Tenant context is required.");
        }

        // The names and prices here are the cafe's own and only shown in the kitchen. A copy that names real
        // menu items could be paid as a restaurant order at the client's prices, so it is refused.
        List<Guid> ids = [.. request.Items.Select(i => i.CatalogItemId).Distinct()];
        IReadOnlyList<MenuItem> menuItems = await menuItemRepository.FindByIdsAsync(request.BranchId, ids, cancellationToken);
        if (menuItems.Count > 0)
        {
            return RestaurantErrors.KitchenCopyHasMenuItems;
        }

        ErrorOr<RestaurantOrder> orderResult = RestaurantOrder.Create(
            tenantId,
            request.BranchId,
            request.TableNumber,
            request.Items.Select(i => (i.CatalogItemId, i.ItemName, i.Quantity, i.UnitPrice, i.Notes)),
            request.Notes,
            discountCode: null,
            discountAmount: 0m,
            isKitchenCopy: true);

        if (orderResult.IsError)
        {
            return orderResult.Errors;
        }

        orderRepository.Add(orderResult.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantOrderMapper.ToResponse(orderResult.Value);
    }
}
