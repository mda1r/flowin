using Microsoft.EntityFrameworkCore;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Infrastructure.Persistence.Repositories;

internal sealed class RestaurantOrderRepository(RestaurantDbContext dbContext) : IRestaurantOrderRepository
{
    private static readonly RestaurantOrderStatus[] _activeStatuses =
    [
        RestaurantOrderStatus.Pending,
        RestaurantOrderStatus.InKitchen,
        RestaurantOrderStatus.Ready,
        RestaurantOrderStatus.Served,
    ];

    private static readonly TimeSpan _kitchenTicketLifetime = TimeSpan.FromHours(12);

    public async Task<RestaurantOrder?> FindByIdAsync(
        RestaurantOrderId id,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.RestaurantOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<RestaurantOrder>> FindActiveByBranchAsync(
        Guid branchId,
        CancellationToken cancellationToken = default)
    {
        // A cafe kitchen ticket leaves the board once served, and a forgotten one stops showing after a day's work.
        DateTime staleBefore = DateTime.UtcNow - _kitchenTicketLifetime;
        return await dbContext.RestaurantOrders
            .Include(o => o.Items)
            .Where(o => o.BranchId == branchId && _activeStatuses.Contains(o.Status))
            .Where(o => !o.KitchenOnly || (o.Status != RestaurantOrderStatus.Served && o.CreatedAt >= staleBefore))
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<RestaurantOrder>> FindByTableAsync(
        Guid branchId,
        int tableNumber,
        CancellationToken cancellationToken = default)
    {
        DateTime today = DateTime.UtcNow.Date;
        return await dbContext.RestaurantOrders
            .Include(o => o.Items)
            .Where(o => o.BranchId == branchId
                && o.TableNumber == tableNumber
                && !o.KitchenOnly
                && o.CreatedAt >= today)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public void Add(RestaurantOrder order) => dbContext.RestaurantOrders.Add(order);

    public void Update(RestaurantOrder order) => dbContext.RestaurantOrders.Update(order);
}
