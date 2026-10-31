using ErrorOr;
using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Gaming.Application.Commands.CreateStation;

internal sealed class CreateStationCommandHandler(
    IGameStationRepository gameStationRepository,
    GamingDbContext dbContext,
    ITenantContext tenantContext)
    : ICommandHandler<CreateStationCommand, GameStationResponse>
{
    public async Task<ErrorOr<GameStationResponse>> Handle(
        CreateStationCommand request,
        CancellationToken cancellationToken)
    {
        // The tenant comes from the signed-in user's token, never from the request body.
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Error.Unauthorized("Gaming.NoTenant", "Tenant context is required.");
        }

        ErrorOr<GameStation> station = GameStation.Create(
            tenantId, request.BranchId, request.StationType,
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
