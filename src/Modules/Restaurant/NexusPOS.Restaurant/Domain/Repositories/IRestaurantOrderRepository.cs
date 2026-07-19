using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Domain.Repositories;

public interface IRestaurantOrderRepository
{
    Task<RestaurantOrder?> FindByIdAsync(RestaurantOrderId id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RestaurantOrder>> FindActiveByBranchAsync(
        Guid branchId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RestaurantOrder>> FindByTableAsync(
        Guid branchId,
        int tableNumber,
        CancellationToken cancellationToken = default);

    void Add(RestaurantOrder order);

    void Update(RestaurantOrder order);
}
