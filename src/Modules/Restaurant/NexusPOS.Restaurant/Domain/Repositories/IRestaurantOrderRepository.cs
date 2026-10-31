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

    // Open restaurant orders of one table, oldest first; cafe kitchen copies are not included.
    Task<IReadOnlyList<RestaurantOrder>> FindOpenByTableAsync(
        Guid branchId,
        int tableNumber,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RestaurantOrder>> FindByTableAsync(
        Guid branchId,
        int tableNumber,
        CancellationToken cancellationToken = default);

    void Add(RestaurantOrder order);

    void Update(RestaurantOrder order);
}
