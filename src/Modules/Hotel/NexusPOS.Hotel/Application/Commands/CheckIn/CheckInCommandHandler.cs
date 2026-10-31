using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using Npgsql;

namespace NexusPOS.Hotel.Application.Commands.CheckIn;

internal sealed class CheckInCommandHandler(
    IRoomRepository roomRepository,
    IReservationRepository reservationRepository,
    HotelDbContext dbContext)
    : ICommandHandler<CheckInCommand, ReservationResponse>
{
    // Partial unique index on reservations (room_id) WHERE status = 'Active'; see MigrateHotelColumnsAsync.
    private const string ActiveRoomIndex = "ux_reservations_active_room";

    public async Task<ErrorOr<ReservationResponse>> Handle(
        CheckInCommand request,
        CancellationToken cancellationToken)
    {
        Room? room = await roomRepository.FindByIdAsync(
            new RoomId(request.RoomId), cancellationToken);

        if (room is null || room.BranchId != request.BranchId)
        {
            return HotelErrors.RoomNotFound;
        }

        if (await reservationRepository.FindActiveByRoomAsync(room.Id.Value, cancellationToken) is not null)
        {
            return HotelErrors.RoomAlreadyOccupied;
        }

        ErrorOr<Success> occupyResult = room.OccupyRoom();
        if (occupyResult.IsError)
        {
            return occupyResult.Errors;
        }

        ErrorOr<Reservation> reservationResult = Reservation.Create(
            request.TenantId,
            request.BranchId,
            request.RoomId,
            request.GuestName,
            request.GuestNationalId,
            request.GuestPhone,
            request.CheckIn,
            request.CheckOut,
            request.RatePerNight,
            request.Notes);

        if (reservationResult.IsError)
        {
            return reservationResult.Errors;
        }

        reservationRepository.Add(reservationResult.Value);
        roomRepository.Update(room);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: ActiveRoomIndex })
        {
            // Another check-in for this room was saved first (second terminal or a double submit).
            return HotelErrors.RoomAlreadyOccupied;
        }

        return HotelMapper.ToReservationResponse(reservationResult.Value);
    }
}
