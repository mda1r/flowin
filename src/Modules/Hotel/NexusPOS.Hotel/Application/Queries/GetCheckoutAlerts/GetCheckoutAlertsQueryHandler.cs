using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.GetCheckoutAlerts;

internal sealed class GetCheckoutAlertsQueryHandler(IReservationRepository reservationRepository)
    : IQueryHandler<GetCheckoutAlertsQuery, IReadOnlyList<ReservationResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ReservationResponse>>> Handle(
        GetCheckoutAlertsQuery request,
        CancellationToken cancellationToken)
    {
        // Reservations checking out within the next 2 hours (or already overdue)
        DateTime threshold = DateTime.UtcNow.AddHours(2);

        IReadOnlyList<Domain.Entities.Reservation> alerts =
            await reservationRepository.FindCheckoutAlertsAsync(
                request.BranchId, threshold, cancellationToken);

        return alerts.Select(HotelMapper.ToReservationResponse).ToList();
    }
}
