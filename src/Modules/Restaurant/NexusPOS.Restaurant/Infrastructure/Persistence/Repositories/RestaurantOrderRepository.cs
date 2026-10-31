using Microsoft.EntityFrameworkCore;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Infrastructure.Persistence.Repositories;

internal sealed class RestaurantOrderRepository(RestaurantDbContext dbContext) : IRestaurantOrderRepository
{
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
        DateTime since,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.RestaurantOrders
            .Include(o => o.Items)
            .Where(RestaurantOrderQueries.Floor(branchId, since))
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<RestaurantOrder>> FindKitchenByBranchAsync(
        Guid branchId,
        DateTime since,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.RestaurantOrders
            .Include(o => o.Items)
            .Where(RestaurantOrderQueries.Kitchen(branchId, since))
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<RestaurantOrder?> FindByTicketAsync(
        Guid branchId,
        string ticketNumber,
        DateTime since,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.RestaurantOrders
            .Include(o => o.Items)
            .Where(o => o.BranchId == branchId && o.TicketNumber == ticketNumber && o.CreatedAt >= since)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
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
                && o.TicketNumber == null
                && o.CreatedAt >= today)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public void Add(RestaurantOrder order) => dbContext.RestaurantOrders.Add(order);

    public void Update(RestaurantOrder order) => dbContext.RestaurantOrders.Update(order);
}
