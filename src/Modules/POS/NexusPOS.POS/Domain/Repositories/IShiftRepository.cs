using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Domain.Repositories;

public interface IShiftRepository
{
    Task<CashierShift?> FindByIdAsync(CashierShiftId id, CancellationToken cancellationToken = default);
    Task<CashierShift?> FindOpenByUserAsync(Guid branchId, Guid userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CashierShift>> ListByBranchAsync(Guid branchId, int page, int pageSize, CancellationToken cancellationToken = default);
    void Add(CashierShift shift);
    void Update(CashierShift shift);
}
