using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.Domain.Repositories;

public interface IRentalContractRepository
{
    Task<RentalContract?> FindByIdAsync(RentalContractId id, CancellationToken ct = default);
    Task<IReadOnlyList<RentalContract>> ListByBranchAsync(Guid branchId, int page, int pageSize, CancellationToken ct = default);
    void Add(RentalContract contract);
    void Update(RentalContract contract);
}
