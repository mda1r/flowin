using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.Gaming.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Commands.ReturnToService;

internal sealed class ReturnToServiceCommandHandler(
    IGameStationRepository gameStationRepository,
    IGameSessionRepository gameSessionRepository,
    GamingDbContext dbContext)
    : ICommandHandler<ReturnToServiceCommand, GameStationResponse>
{
    public async Task<ErrorOr<GameStationResponse>> Handle(
        ReturnToServiceCommand request,
        CancellationToken cancellationToken)
    {
        GameStation? station = await gameStationRepository.FindByIdAsync(
            new GameStationId(request.StationId), cancellationToken);

        if (station is null || station.BranchId != request.BranchId)
        {
            return GamingErrors.StationNotFound;
        }

        GameSession? activeSession = await gameSessionRepository.FindActiveByStationAsync(
            request.StationId, cancellationToken);

        ErrorOr<Success> result = station.ReturnToService(activeSession is not null);
        if (result.IsError)
        {
            return result.Errors;
        }

        gameStationRepository.Update(station);
        await dbContext.SaveChangesAsync(cancellationToken);

        return GamingMapper.ToResponse(station, activeSession);
    }
}
