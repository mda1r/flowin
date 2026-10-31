using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Domain.Repositories;

public interface IRestaurantOrderRepository
{
    Task<RestaurantOrder?> FindByIdAsync(RestaurantOrderId id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RestaurantOrder>> FindActiveByBranchAsync(
        Guid branchId,
        DateTime since,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RestaurantOrder>> FindKitchenByBranchAsync(
        Guid branchId,
        DateTime since,
        CancellationToken cancellationToken = default);

    // A cafe ticket already mirrored to the kitchen, so a till retrying after a lost response does not send it twice.
    Task<RestaurantOrder?> FindByTicketAsync(
        Guid branchId,
        string ticketNumber,
        DateTime since,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RestaurantOrder>> FindByTableAsync(
        Guid branchId,
        int tableNumber,
        CancellationToken cancellationToken = default);

    void Add(RestaurantOrder order);

    void Update(RestaurantOrder order);
}
