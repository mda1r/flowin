using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Gaming.Infrastructure.Persistence;

namespace NexusPOS.Gaming.Application.Commands.EndSession;

internal sealed class EndSessionCommandHandler(
    IGameStationRepository gameStationRepository,
    IGameSessionRepository gameSessionRepository,
    GamingDbContext dbContext)
    : ICommandHandler<EndSessionCommand, GameStationResponse>
{
    public async Task<ErrorOr<GameStationResponse>> Handle(
        EndSessionCommand request,
        CancellationToken cancellationToken)
    {
        GameStation? station = await gameStationRepository.FindByIdAsync(
            new GameStationId(request.StationId), cancellationToken);

        if (station is null || station.BranchId != request.BranchId)
        {
            return GamingErrors.StationNotFound;
        }

        ErrorOr<Success> result = station.EndSession();
        if (result.IsError)
        {
            return result.Errors;
        }

        // Also complete the active GameSession if one exists
        GameSession? activeSession = await gameSessionRepository.FindActiveByStationAsync(
            request.StationId, cancellationToken);

        if (activeSession is not null)
        {
            activeSession.Complete();
            gameSessionRepository.Update(activeSession);
        }

        gameStationRepository.Update(station);
        await dbContext.SaveChangesAsync(cancellationToken);

        return GamingMapper.ToResponse(station, null);
    }
}
