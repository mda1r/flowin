using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Infrastructure.Persistence.Repositories;

internal sealed class ShiftRepository(PosDbContext dbContext) : IShiftRepository
{
    public async Task<CashierShift?> FindByIdAsync(CashierShiftId id, CancellationToken cancellationToken = default)
    {
        return await dbContext.CashierShifts
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
    }

    public async Task<CashierShift?> FindOpenByUserAsync(Guid branchId, Guid userId, CancellationToken cancellationToken = default)
    {
        return await dbContext.CashierShifts
            .FirstOrDefaultAsync(s => s.BranchId == branchId
                                   && s.UserId == userId
                                   && s.Status == ShiftStatus.Open, cancellationToken);
    }

    public async Task<IReadOnlyList<CashierShift>> ListByBranchAsync(Guid branchId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        return await dbContext.CashierShifts
            .Where(s => s.BranchId == branchId)
            .OrderByDescending(s => s.OpenedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public void Add(CashierShift shift) => dbContext.CashierShifts.Add(shift);

    public void Update(CashierShift shift) => dbContext.CashierShifts.Update(shift);
}
