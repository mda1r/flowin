using ErrorOr;

namespace NexusPOS.Hotel.Domain;

public static class HotelErrors
{
    // Room errors
    public static readonly Error RoomNotFound =
        Error.NotFound("Room.NotFound", "Room not found.");

    public static readonly Error InvalidNightlyRate =
        Error.Validation("Room.InvalidNightlyRate", "Nightly rate must be greater than zero.");

    public static readonly Error InvalidCapacity =
        Error.Validation("Room.InvalidCapacity", "Room capacity must be greater than zero.");

    public static readonly Error RoomNumberTaken =
        Error.Conflict("Room.RoomNumberTaken", "A room with this number already exists in the branch.");

    public static readonly Error RoomStatusUnchanged =
        Error.Conflict("Room.StatusUnchanged", "The room is already in the requested status.");

    public static readonly Error InvalidStatusTransition =
        Error.Conflict("Room.InvalidStatusTransition", "An occupied room cannot be set directly to available.");

    public static readonly Error RoomAlreadyOccupied =
        Error.Conflict("Room.AlreadyOccupied", "Room is already occupied.");

    public static readonly Error RoomUnderMaintenance =
        Error.Conflict("Room.UnderMaintenance", "Room is under maintenance and cannot be checked into.");

    public static readonly Error RoomNotOccupied =
        Error.Conflict("Room.NotOccupied", "Room is not currently occupied.");

    // Reservation errors
    public static readonly Error ReservationNotFound =
        Error.NotFound("Reservation.NotFound", "Reservation not found.");

    public static readonly Error ReservationNotActive =
        Error.Conflict("Reservation.NotActive", "Reservation is not in active status.");

    public static readonly Error InvalidCheckoutDate =
        Error.Validation("Reservation.InvalidCheckoutDate", "Check-out date must be after check-in date (at least 1 night).");
}
