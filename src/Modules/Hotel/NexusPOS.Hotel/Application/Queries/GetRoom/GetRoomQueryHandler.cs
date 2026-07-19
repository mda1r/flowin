using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.GetRoom;

internal sealed class GetRoomQueryHandler(IRoomRepository roomRepository)
    : IQueryHandler<GetRoomQuery, RoomResponse>
{
    public async Task<ErrorOr<RoomResponse>> Handle(
        GetRoomQuery request,
        CancellationToken cancellationToken)
    {
        Room? room = await roomRepository.FindByIdAsync(
            new RoomId(request.RoomId), cancellationToken);

        if (room is null || room.BranchId != request.BranchId)
        {
            return HotelErrors.RoomNotFound;
        }

        return HotelMapper.ToResponse(room);
    }
}
