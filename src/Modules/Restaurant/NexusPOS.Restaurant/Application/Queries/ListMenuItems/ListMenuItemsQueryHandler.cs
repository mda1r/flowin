using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListMenuItems;

internal sealed class ListMenuItemsQueryHandler(IMenuItemRepository menuItemRepository)
    : IQueryHandler<ListMenuItemsQuery, IReadOnlyList<MenuItemResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<MenuItemResponse>>> Handle(
        ListMenuItemsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Domain.Entities.MenuItem> items = await menuItemRepository.FindByBranchAsync(
            request.BranchId, request.Category, request.IncludeUnavailable,
            request.Page, request.PageSize, cancellationToken);

        return items.Select(RestaurantMapper.ToResponse).ToList();
    }
}
