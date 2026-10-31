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

        Dictionary<Guid, GameSession> sessionByStation = activeSessions
            .ToDictionary(s => s.StationId);

        return stations
            .Select(s => GamingMapper.ToResponse(s, sessionByStation.GetValueOrDefault(s.Id.Value)))
            .ToList();
    }
}
