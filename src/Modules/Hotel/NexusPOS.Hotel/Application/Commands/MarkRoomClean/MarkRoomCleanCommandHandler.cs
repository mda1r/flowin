using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.MarkRoomClean;

internal sealed class MarkRoomCleanCommandHandler(
    IRoomRepository roomRepository,
    HotelDbContext dbContext)
    : ICommandHandler<MarkRoomCleanCommand, RoomResponse>
{
    public async Task<ErrorOr<RoomResponse>> Handle(
        MarkRoomCleanCommand request,
        CancellationToken cancellationToken)
    {
        Room? room = await roomRepository.FindByIdAsync(
            new RoomId(request.RoomId), cancellationToken);

        if (room is null || room.BranchId != request.BranchId)
        {
            return HotelErrors.RoomNotFound;
        }

        room.MarkClean();
        roomRepository.Update(room);
        await dbContext.SaveChangesAsync(cancellationToken);

        return HotelMapper.ToResponse(room);
    }
}
