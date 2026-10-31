using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Domain.Repositories;

public interface IReturnOrderRepository
{
    Task<ReturnOrder?> FindByIdAsync(ReturnOrderId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ReturnOrder>> FindByOriginalOrderAsync(Guid originalOrderId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ReturnOrder>> FindByBranchAsync(Guid branchId, DateTime? dateFrom, DateTime? dateTo, CancellationToken cancellationToken = default);
    Task<ReturnOrder?> FindByClientReferenceAsync(Guid clientReference, CancellationToken cancellationToken = default);
    // Unit cost of each original sale line, so reports can put returned goods back into stock value.
    Task<IReadOnlyDictionary<Guid, decimal>> FindOriginalLineCostsAsync(
        IReadOnlyCollection<Guid> orderLineIds, CancellationToken cancellationToken = default);
    void Add(ReturnOrder returnOrder);
}
