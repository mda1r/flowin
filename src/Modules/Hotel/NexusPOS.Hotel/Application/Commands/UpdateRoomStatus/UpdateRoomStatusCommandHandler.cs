using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Hotel.Infrastructure.Persistence;

namespace NexusPOS.Hotel.Application.Commands.UpdateRoomStatus;

internal sealed class UpdateRoomStatusCommandHandler(
    IRoomRepository roomRepository,
    IReservationRepository reservationRepository,
    HotelDbContext dbContext)
    : ICommandHandler<UpdateRoomStatusCommand, RoomResponse>
{
    public async Task<ErrorOr<RoomResponse>> Handle(
        UpdateRoomStatusCommand request,
        CancellationToken cancellationToken)
    {
        Room? room = await roomRepository.FindByIdAsync(
            new RoomId(request.RoomId), cancellationToken);

        if (room is null || room.BranchId != request.BranchId)
        {
            return HotelErrors.RoomNotFound;
        }

        // Occupancy is driven by check-in/check-out only, so a room with a guest in it
        // cannot be freed (even via Maintenance) and no room can be marked occupied by hand.
        if (request.NewStatus == RoomStatus.Occupied)
        {
            return HotelErrors.RoomOccupiedOnlyByCheckIn;
        }

        if (await reservationRepository.FindActiveByRoomAsync(room.Id.Value, cancellationToken) is not null)
        {
            return HotelErrors.RoomHasActiveReservation;
        }

        ErrorOr<Success> result = room.SetStatus(request.NewStatus);
        if (result.IsError)
        {
            return result.Errors;
        }

        roomRepository.Update(room);
        await dbContext.SaveChangesAsync(cancellationToken);

        return HotelMapper.ToResponse(room);
    }
}
