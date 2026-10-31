using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Queries.ListStations;

internal sealed class ListStationsQueryHandler(
    IGameStationRepository gameStationRepository,
    IGameSessionRepository gameSessionRepository)
    : IQueryHandler<ListStationsQuery, IReadOnlyList<GameStationResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<GameStationResponse>>> Handle(
        ListStationsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<GameStation> stations = await gameStationRepository.FindByBranchAsync(
            request.BranchId, request.StationType, request.Status,
            request.Page, request.PageSize, cancellationToken);

        IReadOnlyList<GameSession> activeSessions = await gameSessionRepository.FindActiveByBranchAsync(
            request.BranchId, cancellationToken);

        // The unique index keeps one active session per station; if older data has two, show the latest
        // instead of failing the whole page.
        Dictionary<Guid, GameSession> sessionByStation = activeSessions
            .GroupBy(s => s.StationId)
            .ToDictionary(g => g.Key, g => g.MaxBy(s => s.StartTime)!);

        return stations
            .Select(s => GamingMapper.ToResponse(s, sessionByStation.GetValueOrDefault(s.Id.Value)))
            .ToList();
    }
}
