using Microsoft.EntityFrameworkCore;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.Infrastructure.Persistence.Repositories;

internal sealed class RentalContractRepository(HotelDbContext dbContext) : IRentalContractRepository
{
    public async Task<RentalContract?> FindByIdAsync(RentalContractId id, CancellationToken ct = default) =>
        await dbContext.RentalContracts.FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task<IReadOnlyList<RentalContract>> ListByBranchAsync(
        Guid branchId, int page, int pageSize, CancellationToken ct = default) =>
        await dbContext.RentalContracts
            .Where(c => c.BranchId == branchId)
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public void Add(RentalContract contract) => dbContext.RentalContracts.Add(contract);

    public void Update(RentalContract contract) => dbContext.RentalContracts.Update(contract);
}
