using ErrorOr;
using NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;

namespace NexusPOS.Restaurant.Application.Common;

// Turns what the till asked for into order lines priced from the branch's menu. A client can choose dishes
// and quantities but never their names or prices.
internal static class MenuOrderLines
{
    public static async Task<ErrorOr<List<(Guid MenuItemId, string ItemName, int Quantity, decimal UnitPrice, string? Notes)>>> ResolveAsync(
        IMenuItemRepository menuItemRepository,
        Guid branchId,
        IReadOnlyList<OrderItemInput> items,
        CancellationToken cancellationToken)
    {
        List<Guid> ids = [.. items.Select(i => i.MenuItemId).Distinct()];
        IReadOnlyList<MenuItem> menu = await menuItemRepository.FindByIdsAsync(branchId, ids, cancellationToken);
        return Resolve(items, menu.ToDictionary(m => m.Id.Value));
    }

    public static ErrorOr<List<(Guid MenuItemId, string ItemName, int Quantity, decimal UnitPrice, string? Notes)>> Resolve(
        IReadOnlyList<OrderItemInput> items,
        IReadOnlyDictionary<Guid, MenuItem> menu)
    {
        List<(Guid, string, int, decimal, string?)> lines = [];
        foreach (OrderItemInput item in items)
        {
            if (!menu.TryGetValue(item.MenuItemId, out MenuItem? menuItem))
            {
                return RestaurantErrors.MenuItemNotFound;
            }

            if (!menuItem.IsAvailable)
            {
                return RestaurantErrors.MenuItemUnavailable;
            }

            lines.Add((menuItem.Id.Value, menuItem.Name, item.Quantity, menuItem.Price, item.Notes));
        }

        return lines;
    }
}
