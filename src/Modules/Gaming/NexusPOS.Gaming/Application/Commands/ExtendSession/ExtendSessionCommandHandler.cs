using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Gaming.Infrastructure.Persistence;

namespace NexusPOS.Gaming.Application.Commands.ExtendSession;

internal sealed class ExtendSessionCommandHandler(
    IGameSessionRepository gameSessionRepository,
    IGameStationRepository gameStationRepository,
    GamingDbContext dbContext)
    : ICommandHandler<ExtendSessionCommand, GameStationResponse>
{
    public async Task<ErrorOr<GameStationResponse>> Handle(
        ExtendSessionCommand request,
        CancellationToken cancellationToken)
    {
        GameSession? session = await gameSessionRepository.FindByIdAsync(request.SessionId, cancellationToken);

        if (session is null || session.BranchId != request.BranchId)
        {
            return GamingErrors.SessionNotFound;
        }

        if (session.Status != GameSessionStatus.Active)
        {
            return GamingErrors.SessionNotActive;
        }

        session.Extend(request.ExtraMinutes);
        gameSessionRepository.Update(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        GameStation? station = await gameStationRepository.FindByIdAsync(
            new GameStationId(session.StationId), cancellationToken);

        if (station is null)
        {
            return GamingErrors.StationNotFound;
        }

        return GamingMapper.ToResponse(station, session);
    }
}
