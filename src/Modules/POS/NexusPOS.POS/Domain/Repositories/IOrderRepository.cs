using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Domain.Repositories;

public interface IOrderRepository
{
    Task<Order?> FindByIdAsync(OrderId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Order>> FindByBranchAsync(Guid branchId, OrderStatus? status, DateTime? dateFrom, DateTime? dateTo, int page, int pageSize, CancellationToken cancellationToken = default);
    void Add(Order order);
    void Update(Order order);
}
