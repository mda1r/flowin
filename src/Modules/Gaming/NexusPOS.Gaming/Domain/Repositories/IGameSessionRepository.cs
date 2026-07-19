using NexusPOS.Gaming.Domain.Entities;

namespace NexusPOS.Gaming.Domain.Repositories;

public interface IGameSessionRepository
{
    Task<GameSession?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<GameSession?> FindActiveByStationAsync(Guid stationId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<GameSession>> FindActiveByBranchAsync(Guid branchId, CancellationToken cancellationToken = default);
    void Add(GameSession session);
    void Update(GameSession session);
}
