using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.Gaming.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using Npgsql;

namespace NexusPOS.Gaming.Application.Commands.StartSession;

internal sealed class StartSessionCommandHandler(
    IGameStationRepository gameStationRepository,
    IGameSessionRepository gameSessionRepository,
    GamingDbContext dbContext)
    : ICommandHandler<StartSessionCommand, GameStationResponse>
{
    // Partial unique index (one Active session per station), created by the gaming schema patches.
    internal const string ActiveStationIndex = "ux_game_sessions_active_station";

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

        // Billed at the station's rate; only an owner or manager may set another one.
        ErrorOr<decimal> rate = station.ResolveSessionRate(request.RatePerHour, request.CanOverrideRate);
        if (rate.IsError)
        {
            return rate.Errors;
        }

        ErrorOr<Success> result = station.StartSession();
        if (result.IsError)
        {
            return result.Errors;
        }

        GameSession session = package is null
            ? GameSession.Create(
                station.TenantId, station.BranchId, station.Id.Value, request.PlayerName, request.DurationMinutes, rate.Value)
            : GameSession.CreateWithPackage(
                station.TenantId, station.BranchId, station.Id.Value, request.PlayerName, package, rate.Value);

        gameSessionRepository.Add(session);
        gameStationRepository.Update(station);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: ActiveStationIndex,
        })
        {
            // Another cashier started a session on this station a moment earlier.
            return GamingErrors.StationHasActiveSession;
        }

        return GamingMapper.ToResponse(station, session);
    }
}
