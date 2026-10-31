using Microsoft.EntityFrameworkCore;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Infrastructure.Persistence.Repositories;

internal sealed class MenuItemRepository(RestaurantDbContext dbContext) : IMenuItemRepository
{
    public async Task<MenuItem?> FindByIdAsync(MenuItemId id, CancellationToken cancellationToken = default)
        => await dbContext.MenuItems
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public async Task<IReadOnlyList<MenuItem>> FindByBranchAsync(
        Guid branchId,
        MenuCategory? category,
        bool includeUnavailable,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        IQueryable<MenuItem> query = dbContext.MenuItems.Where(e => e.BranchId == branchId);

        if (!includeUnavailable)
        {
            query = query.Where(e => e.IsAvailable);
        }

        if (category.HasValue)
        {
            query = query.Where(e => e.Category == category.Value);
        }

        return await query
            .OrderBy(e => e.SortOrder)
            .ThenBy(e => e.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public void Add(MenuItem menuItem) => dbContext.MenuItems.Add(menuItem);

    public void Update(MenuItem menuItem) => dbContext.MenuItems.Update(menuItem);
}
