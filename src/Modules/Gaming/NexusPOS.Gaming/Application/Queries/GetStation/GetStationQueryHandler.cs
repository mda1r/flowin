using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Queries.GetStation;

internal sealed class GetStationQueryHandler(IGameStationRepository gameStationRepository)
    : IQueryHandler<GetStationQuery, GameStationResponse>
{
    public async Task<ErrorOr<GameStationResponse>> Handle(
        GetStationQuery request,
        CancellationToken cancellationToken)
    {
        GameStation? station = await gameStationRepository.FindByIdAsync(
            new GameStationId(request.StationId), cancellationToken);

        if (station is null || station.BranchId != request.BranchId)
        {
            return GamingErrors.StationNotFound;
        }

        return GamingMapper.ToResponse(station);
    }
}
