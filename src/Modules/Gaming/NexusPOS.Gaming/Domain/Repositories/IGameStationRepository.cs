using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Domain.ValueObjects;

namespace NexusPOS.Gaming.Domain.Repositories;

public interface IGameStationRepository
{
    Task<GameStation?> FindByIdAsync(GameStationId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<GameStation>> FindByBranchAsync(Guid branchId, StationType? stationType, StationStatus? status, int page, int pageSize, CancellationToken cancellationToken = default);
    void Add(GameStation station);
    void Update(GameStation station);
}
