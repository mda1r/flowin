using Microsoft.EntityFrameworkCore;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Domain.Repositories;

namespace NexusPOS.Gaming.Infrastructure.Persistence.Repositories;

internal sealed class GameSessionRepository(GamingDbContext dbContext) : IGameSessionRepository
{
    public async Task<GameSession?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await dbContext.GameSessions
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public async Task<GameSession?> FindActiveByStationAsync(Guid stationId, CancellationToken cancellationToken = default)
        => await dbContext.GameSessions
            .FirstOrDefaultAsync(
                e => e.StationId == stationId && e.Status == GameSessionStatus.Active,
                cancellationToken);

    public async Task<IReadOnlyList<GameSession>> FindActiveByBranchAsync(Guid branchId, CancellationToken cancellationToken = default)
        => await dbContext.GameSessions
            .Where(e => e.BranchId == branchId && e.Status == GameSessionStatus.Active)
            .OrderBy(e => e.StartTime)
            .ToListAsync(cancellationToken);

    public void Add(GameSession session) => dbContext.GameSessions.Add(session);

    public void Update(GameSession session) => dbContext.GameSessions.Update(session);
}
