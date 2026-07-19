using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Gaming.Infrastructure.Persistence;

namespace NexusPOS.Gaming.Application.Commands.StartSession;

internal sealed class StartSessionCommandHandler(
    IGameStationRepository gameStationRepository,
    IGameSessionRepository gameSessionRepository,
    GamingDbContext dbContext)
    : ICommandHandler<StartSessionCommand, GameStationResponse>
{
    public async Task<ErrorOr<GameStationResponse>> Handle(
        StartSessionCommand request,
        CancellationToken cancellationToken)
    {
        GameStation? station = await gameStationRepository.FindByIdAsync(
            new GameStationId(request.StationId), cancellationToken);

        if (station is null || station.BranchId != request.BranchId)
        {
            return GamingErrors.StationNotFound;
        }

        ErrorOr<Success> result = station.StartSession();
        if (result.IsError)
        {
            return result.Errors;
        }

        GameSession session = GameSession.Create(
            station.TenantId,
            station.BranchId,
            station.Id.Value,
            request.PlayerName,
            request.DurationMinutes,
            request.RatePerHour);

        gameSessionRepository.Add(session);
        gameStationRepository.Update(station);
        await dbContext.SaveChangesAsync(cancellationToken);

        return GamingMapper.ToResponse(station, session);
    }
}
