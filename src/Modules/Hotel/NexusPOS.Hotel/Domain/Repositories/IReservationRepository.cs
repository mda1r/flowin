using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.Domain.Repositories;

public interface IReservationRepository
{
    Task<Reservation?> FindByIdAsync(ReservationId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Reservation>> FindActiveByBranchAsync(Guid branchId, CancellationToken cancellationToken = default);
    Task<Reservation?> FindActiveByRoomAsync(Guid roomId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Reservation>> FindCheckoutAlertsAsync(Guid branchId, DateTime threshold, CancellationToken cancellationToken = default);
    void Add(Reservation reservation);
    void Update(Reservation reservation);
}
