using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;

namespace NexusPOS.Hotel.Application.Common;

internal static class HotelMapper
{
    internal static RoomResponse ToResponse(Room room, ReservationResponse? activeReservation = null)
    {
        bool checkOutAlert = activeReservation is not null
            && activeReservation.CheckOut <= DateTime.UtcNow.AddHours(2)
            && activeReservation.Status == ReservationStatus.Active;

        return new RoomResponse(
            room.Id.Value,
            room.TenantId,
            room.BranchId,
            room.RoomType,
            room.RoomNumber,
            room.Floor,
            room.Capacity,
            room.NightlyRate,
            room.Currency,
            room.Status,
            room.CleaningStatus,
            room.Description,
            room.IsActive,
            room.CreatedAt,
            room.UpdatedAt,
            checkOutAlert,
            activeReservation);
    }

    internal static ReservationResponse ToReservationResponse(Reservation reservation) => new(
        reservation.Id.Value,
        reservation.RoomId,
        reservation.TenantId,
        reservation.BranchId,
        reservation.GuestName,
        reservation.GuestNationalId,
        reservation.GuestPhone,
        reservation.CheckIn,
        reservation.CheckOut,
        reservation.Nights,
        reservation.RatePerNight,
        reservation.TotalAmount,
        reservation.Status,
        reservation.Notes,
        reservation.CreatedAt,
        reservation.UpdatedAt);
}
