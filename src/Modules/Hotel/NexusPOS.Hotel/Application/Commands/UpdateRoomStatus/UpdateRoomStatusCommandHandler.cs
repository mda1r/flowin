using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Hotel.Infrastructure.Persistence;

namespace NexusPOS.Hotel.Application.Commands.UpdateRoomStatus;

internal sealed class UpdateRoomStatusCommandHandler(
    IRoomRepository roomRepository,
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
