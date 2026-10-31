using System.Linq.Expressions;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.Domain;

// Which orders each screen polls for. Both look back one day at most, so an order nobody closed (a table never
// cashed up, a cafe ticket from last week) stops riding along on every refresh.
public static class RestaurantOrderQueries
{
    public static readonly TimeSpan LookBack = TimeSpan.FromHours(24);

    private static readonly RestaurantOrderStatus[] _floorStatuses =
    [
        RestaurantOrderStatus.Pending,
        RestaurantOrderStatus.InKitchen,
        RestaurantOrderStatus.Ready,
        RestaurantOrderStatus.Served,
    ];

    private static readonly RestaurantOrderStatus[] _kitchenStatuses =
    [
        RestaurantOrderStatus.Pending,
        RestaurantOrderStatus.InKitchen,
        RestaurantOrderStatus.Ready,
    ];

    // Open orders on the restaurant floor. Cafe kitchen tickets were paid at the till, so they never hold a table.
    public static Expression<Func<RestaurantOrder, bool>> Floor(Guid branchId, DateTime since) =>
        o => o.BranchId == branchId
            && o.CreatedAt >= since
            && o.TicketNumber == null
            && _floorStatuses.Contains(o.Status);

    // What the kitchen still has to make or hand over: served orders leave the screen.
    public static Expression<Func<RestaurantOrder, bool>> Kitchen(Guid branchId, DateTime since) =>
        o => o.BranchId == branchId
            && o.CreatedAt >= since
            && _kitchenStatuses.Contains(o.Status);
}
