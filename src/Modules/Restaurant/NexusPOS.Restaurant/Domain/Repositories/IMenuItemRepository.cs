using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Domain.Repositories;

public interface IMenuItemRepository
{
    Task<MenuItem?> FindByIdAsync(MenuItemId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<MenuItem>> FindByBranchAsync(Guid branchId, MenuCategory? category, bool includeUnavailable, int page, int pageSize, CancellationToken cancellationToken = default);
    void Add(MenuItem menuItem);
    void Update(MenuItem menuItem);
}
