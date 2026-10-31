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

        GamingPackage? package = null;
        if (request.PackageId is Guid packageId)
        {
            package = await dbContext.GamingPackages.FindAsync([packageId], cancellationToken);
            if (package is null || !package.IsActive || package.BranchId != request.BranchId)
            {
                return GamingErrors.PackageNotFound;
            }

            if (!package.FitsStation(station.StationType))
            {
                return GamingErrors.PackageNotForStation;
            }
        }

        ErrorOr<Success> result = station.StartSession();
        if (result.IsError)
        {
            return result.Errors;
        }

        GameSession session = package is null
            ? GameSession.Create(
                station.TenantId, station.BranchId, station.Id.Value, request.PlayerName, request.DurationMinutes, request.RatePerHour)
            : GameSession.CreateWithPackage(
                station.TenantId, station.BranchId, station.Id.Value, request.PlayerName, package, request.RatePerHour);

        gameSessionRepository.Add(session);
        gameStationRepository.Update(station);
        await dbContext.SaveChangesAsync(cancellationToken);

        return GamingMapper.ToResponse(station, session);
    }
}
