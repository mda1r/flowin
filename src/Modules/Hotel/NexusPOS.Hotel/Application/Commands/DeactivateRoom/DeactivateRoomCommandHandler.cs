using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Hotel.Infrastructure.Persistence;

namespace NexusPOS.Hotel.Application.Commands.DeactivateRoom;

internal sealed class DeactivateRoomCommandHandler(
    IRoomRepository roomRepository,
    IReservationRepository reservationRepository,
    HotelDbContext dbContext)
    : ICommandHandler<DeactivateRoomCommand, RoomResponse>
{
    public async Task<ErrorOr<RoomResponse>> Handle(
        DeactivateRoomCommand request,
        CancellationToken cancellationToken)
    {
        Room? room = await roomRepository.FindByIdAsync(
            new RoomId(request.RoomId), cancellationToken);

        if (room is null || room.BranchId != request.BranchId)
        {
            return HotelErrors.RoomNotFound;
        }

        if (await reservationRepository.FindActiveByRoomAsync(room.Id.Value, cancellationToken) is not null)
        {
            return HotelErrors.RoomHasActiveReservation;
        }

        ErrorOr<Success> result = room.Deactivate();
        if (result.IsError)
        {
            return result.Errors;
        }

        roomRepository.Update(room);
        await dbContext.SaveChangesAsync(cancellationToken);

        return HotelMapper.ToResponse(room);
    }
}
