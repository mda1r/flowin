using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.ListRooms;

internal sealed class ListRoomsQueryHandler(IRoomRepository roomRepository)
    : IQueryHandler<ListRoomsQuery, IReadOnlyList<RoomResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<RoomResponse>>> Handle(
        ListRoomsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Domain.Entities.Room> rooms = await roomRepository.FindByBranchAsync(
            request.BranchId, request.RoomType, request.Status,
            request.Page, request.PageSize, cancellationToken);

        return rooms.Select(r => HotelMapper.ToResponse(r)).ToList();
    }
}
