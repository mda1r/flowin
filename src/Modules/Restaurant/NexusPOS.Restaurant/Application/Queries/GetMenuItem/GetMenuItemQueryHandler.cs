using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.GetMenuItem;

internal sealed class GetMenuItemQueryHandler(IMenuItemRepository menuItemRepository)
    : IQueryHandler<GetMenuItemQuery, MenuItemResponse>
{
    public async Task<ErrorOr<MenuItemResponse>> Handle(
        GetMenuItemQuery request,
        CancellationToken cancellationToken)
    {
        MenuItem? menuItem = await menuItemRepository.FindByIdAsync(
            new MenuItemId(request.MenuItemId), cancellationToken);

        if (menuItem is null || menuItem.BranchId != request.BranchId)
        {
            return RestaurantErrors.MenuItemNotFound;
        }

        return RestaurantMapper.ToResponse(menuItem);
    }
}
