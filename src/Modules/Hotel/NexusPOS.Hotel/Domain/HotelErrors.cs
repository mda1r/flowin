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

    public static readonly Error RoomHasActiveReservation =
        Error.Conflict("Room.HasActiveReservation", "The room has an active reservation. Check the guest out or cancel the reservation first.");

    public static readonly Error RoomOccupiedOnlyByCheckIn =
        Error.Validation("Room.OccupiedOnlyByCheckIn", "A room becomes occupied only through check-in.");

    public static readonly Error RoomInactive =
        Error.Conflict("Room.Inactive", "This room has been deactivated.");

    // Reservation errors
    public static readonly Error ReservationNotFound =
        Error.NotFound("Reservation.NotFound", "Reservation not found.");

    public static readonly Error ReservationNotActive =
        Error.Conflict("Reservation.NotActive", "Reservation is not in active status.");

    public static readonly Error InvalidCheckoutDate =
        Error.Validation("Reservation.InvalidCheckoutDate", "Check-out date must be after check-in date (at least 1 night).");

    public static readonly Error InvalidExtendDate =
        Error.Validation("Reservation.InvalidExtendDate", "The new check-out date must be after the current check-out date.");

    // Contract errors
    public static readonly Error ContractNotFound =
        Error.NotFound("Contract.NotFound", "Rental contract not found.");

    public static readonly Error ContractAlreadySigned =
        Error.Conflict("Contract.AlreadySigned", "A signed contract cannot be cancelled.");

    public static readonly Error ContractCancelled =
        Error.Conflict("Contract.Cancelled", "This contract has been cancelled.");

    public static readonly Error ContractAlreadyExecuted =
        Error.Conflict("Contract.AlreadyExecuted", "This contract is already signed.");

    public static readonly Error ContractAlreadyActive =
        Error.Conflict("Contract.AlreadyActive", "This contract is already active.");

    public static readonly Error ContractLocked =
        Error.Conflict("Contract.Locked", "A signed or cancelled contract cannot be edited.");
}
