using Microsoft.EntityFrameworkCore;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;

namespace NexusPOS.Gaming.Infrastructure.Persistence.Repositories;

internal sealed class GameStationRepository(GamingDbContext dbContext) : IGameStationRepository
{
    public async Task<GameStation?> FindByIdAsync(GameStationId id, CancellationToken cancellationToken = default)
        => await dbContext.GameStations
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public async Task<IReadOnlyList<GameStation>> FindByBranchAsync(
        Guid branchId,
        StationType? stationType,
        StationStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        IQueryable<GameStation> query = dbContext.GameStations.Where(e => e.BranchId == branchId);

        if (stationType.HasValue)
        {
            query = query.Where(e => e.StationType == stationType.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(e => e.Status == status.Value);
        }

        return await query
            .OrderBy(e => e.Name)
            .ThenByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public void Add(GameStation station) => dbContext.GameStations.Add(station);

    public void Update(GameStation station) => dbContext.GameStations.Update(station);
}
