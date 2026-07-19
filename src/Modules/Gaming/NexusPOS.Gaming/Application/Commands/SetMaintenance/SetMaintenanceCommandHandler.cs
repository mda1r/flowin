using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Gaming.Infrastructure.Persistence;

namespace NexusPOS.Gaming.Application.Commands.SetMaintenance;

internal sealed class SetMaintenanceCommandHandler(
    IGameStationRepository gameStationRepository,
    GamingDbContext dbContext)
    : ICommandHandler<SetMaintenanceCommand, GameStationResponse>
{
    public async Task<ErrorOr<GameStationResponse>> Handle(
        SetMaintenanceCommand request,
        CancellationToken cancellationToken)
    {
        GameStation? station = await gameStationRepository.FindByIdAsync(
            new GameStationId(request.StationId), cancellationToken);

        if (station is null || station.BranchId != request.BranchId)
        {
            return GamingErrors.StationNotFound;
        }

        ErrorOr<Success> result = station.SetMaintenance();
        if (result.IsError)
        {
            return result.Errors;
        }

        gameStationRepository.Update(station);
        await dbContext.SaveChangesAsync(cancellationToken);

        return GamingMapper.ToResponse(station);
    }
}
