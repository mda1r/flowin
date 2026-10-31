using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Gaming.Infrastructure.Persistence;

namespace NexusPOS.Gaming.Application.Commands.CreateStation;

internal sealed class CreateStationCommandHandler(
    IGameStationRepository gameStationRepository,
    GamingDbContext dbContext)
    : ICommandHandler<CreateStationCommand, GameStationResponse>
{
    public async Task<ErrorOr<GameStationResponse>> Handle(
        CreateStationCommand request,
        CancellationToken cancellationToken)
    {
        ErrorOr<GameStation> station = GameStation.Create(
            request.TenantId, request.BranchId, request.StationType,
            request.Name, request.HourlyRate, request.Currency);

        if (station.IsError)
        {
            return station.Errors;
        }

        gameStationRepository.Add(station.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return GamingMapper.ToResponse(station.Value);
    }
}
