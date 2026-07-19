using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.ListReservations;

internal sealed class ListReservationsQueryHandler(IReservationRepository reservationRepository)
    : IQueryHandler<ListReservationsQuery, IReadOnlyList<ReservationResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ReservationResponse>>> Handle(
        ListReservationsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Domain.Entities.Reservation> reservations =
            await reservationRepository.FindActiveByBranchAsync(request.BranchId, cancellationToken);

        return reservations.Select(HotelMapper.ToReservationResponse).ToList();
    }
}
