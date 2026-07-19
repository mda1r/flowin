using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Domain.Repositories;

public interface IReturnOrderRepository
{
    Task<ReturnOrder?> FindByIdAsync(ReturnOrderId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ReturnOrder>> FindByOriginalOrderAsync(Guid originalOrderId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ReturnOrder>> FindByBranchAsync(Guid branchId, CancellationToken cancellationToken = default);
    void Add(ReturnOrder returnOrder);
}
