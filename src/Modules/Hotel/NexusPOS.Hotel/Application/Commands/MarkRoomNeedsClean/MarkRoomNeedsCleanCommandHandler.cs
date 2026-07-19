using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.MarkRoomNeedsClean;

internal sealed class MarkRoomNeedsCleanCommandHandler(
    IRoomRepository roomRepository,
    HotelDbContext dbContext)
    : ICommandHandler<MarkRoomNeedsCleanCommand, RoomResponse>
{
    public async Task<ErrorOr<RoomResponse>> Handle(
        MarkRoomNeedsCleanCommand request,
        CancellationToken cancellationToken)
    {
        Room? room = await roomRepository.FindByIdAsync(
            new RoomId(request.RoomId), cancellationToken);

        if (room is null || room.BranchId != request.BranchId)
        {
            return HotelErrors.RoomNotFound;
        }

        room.MarkNeedsClean();
        roomRepository.Update(room);
        await dbContext.SaveChangesAsync(cancellationToken);

        return HotelMapper.ToResponse(room);
    }
}
