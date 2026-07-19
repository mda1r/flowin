using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Gaming.Infrastructure.Persistence;

namespace NexusPOS.Gaming.Application.Commands.EndSessionById;

internal sealed class EndSessionByIdCommandHandler(
    IGameSessionRepository gameSessionRepository,
    IGameStationRepository gameStationRepository,
    GamingDbContext dbContext)
    : ICommandHandler<EndSessionByIdCommand, GameSessionBillResponse>
{
    public async Task<ErrorOr<GameSessionBillResponse>> Handle(
        EndSessionByIdCommand request,
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

        session.Complete();
        gameSessionRepository.Update(session);

        GameStation? station = await gameStationRepository.FindByIdAsync(
            new GameStationId(session.StationId), cancellationToken);

        if (station is not null)
        {
            station.EndSession();
            gameStationRepository.Update(station);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return GamingMapper.ToBillResponse(session, station!);
    }
}
