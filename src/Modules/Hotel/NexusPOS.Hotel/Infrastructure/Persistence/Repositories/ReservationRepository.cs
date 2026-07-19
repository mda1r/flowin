using Microsoft.EntityFrameworkCore;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.Infrastructure.Persistence.Repositories;

internal sealed class ReservationRepository(HotelDbContext dbContext) : IReservationRepository
{
    public async Task<Reservation?> FindByIdAsync(
        ReservationId id,
        CancellationToken cancellationToken = default)
        => await dbContext.Reservations
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Reservation>> FindActiveByBranchAsync(
        Guid branchId,
        CancellationToken cancellationToken = default)
        => await dbContext.Reservations
            .Where(r => r.BranchId == branchId && r.Status == ReservationStatus.Active)
            .OrderBy(r => r.CheckOut)
            .ToListAsync(cancellationToken);

    public async Task<Reservation?> FindActiveByRoomAsync(
        Guid roomId,
        CancellationToken cancellationToken = default)
        => await dbContext.Reservations
            .FirstOrDefaultAsync(r => r.RoomId == roomId && r.Status == ReservationStatus.Active, cancellationToken);

    public async Task<IReadOnlyList<Reservation>> FindCheckoutAlertsAsync(
        Guid branchId,
        DateTime threshold,
        CancellationToken cancellationToken = default)
        => await dbContext.Reservations
            .Where(r => r.BranchId == branchId
                     && r.Status == ReservationStatus.Active
                     && r.CheckOut <= threshold)
            .OrderBy(r => r.CheckOut)
            .ToListAsync(cancellationToken);

    public void Add(Reservation reservation) => dbContext.Reservations.Add(reservation);

    public void Update(Reservation reservation) => dbContext.Reservations.Update(reservation);
}
