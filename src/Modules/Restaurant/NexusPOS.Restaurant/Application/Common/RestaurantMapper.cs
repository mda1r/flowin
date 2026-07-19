using NexusPOS.Restaurant.Domain.Entities;

namespace NexusPOS.Restaurant.Application.Common;

internal static class RestaurantMapper
{
    internal static MenuItemResponse ToResponse(MenuItem menuItem) => new(
        menuItem.Id.Value,
        menuItem.TenantId,
        menuItem.BranchId,
        menuItem.Category,
        menuItem.Name,
        menuItem.Description,
        menuItem.Price,
        menuItem.Currency,
        menuItem.IsAvailable,
        menuItem.SortOrder,
        menuItem.CreatedAt,
        menuItem.UpdatedAt);
}
