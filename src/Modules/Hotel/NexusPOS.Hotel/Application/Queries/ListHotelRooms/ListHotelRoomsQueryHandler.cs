using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.ListHotelRooms;

internal sealed class ListHotelRoomsQueryHandler(
    IRoomRepository roomRepository,
    IReservationRepository reservationRepository)
    : IQueryHandler<ListHotelRoomsQuery, IReadOnlyList<RoomResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<RoomResponse>>> Handle(
        ListHotelRoomsQuery request,
        CancellationToken cancellationToken)
    {
        Room[] rooms = [.. await roomRepository.FindByBranchAsync(
            request.BranchId, null, null, 1, 500, cancellationToken)];

        Reservation[] activeReservations = [.. await reservationRepository.FindActiveByBranchAsync(
            request.BranchId, cancellationToken)];

        // Legacy data can hold two active reservations for one room; keep the one that
        // checks out first (the list is ordered by check-out) instead of throwing.
        Dictionary<Guid, ReservationResponse> reservationByRoom = activeReservations
            .GroupBy(r => r.RoomId)
            .ToDictionary(g => g.Key, g => HotelMapper.ToReservationResponse(g.First()));

        List<RoomResponse> result = rooms
            .Select(room =>
            {
                reservationByRoom.TryGetValue(room.Id.Value, out ReservationResponse? activeReservation);
                return HotelMapper.ToResponse(room, activeReservation);
            })
            .ToList();

        return result;
    }
}
