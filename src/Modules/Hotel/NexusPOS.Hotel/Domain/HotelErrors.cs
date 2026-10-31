using ErrorOr;

namespace NexusPOS.Hotel.Domain;

public static class HotelErrors
{
    // Room errors
    public static readonly Error RoomNotFound =
        Error.NotFound("Room.NotFound", "الغرفة غير موجودة");

    public static readonly Error InvalidNightlyRate =
        Error.Validation("Room.InvalidNightlyRate", "سعر الليلة يجب أن يكون أكبر من صفر");

    public static readonly Error InvalidCapacity =
        Error.Validation("Room.InvalidCapacity", "سعة الغرفة يجب أن تكون أكبر من صفر");

    public static readonly Error RoomNumberTaken =
        Error.Conflict("Room.RoomNumberTaken", "يوجد غرفة بنفس الرقم في هذا الفرع");

    public static readonly Error RoomStatusUnchanged =
        Error.Conflict("Room.StatusUnchanged", "الغرفة على هذه الحالة مسبقاً");

    public static readonly Error InvalidStatusTransition =
        Error.Conflict("Room.InvalidStatusTransition", "لا يمكن جعل غرفة مشغولة متاحة مباشرة، سجّل المغادرة أولاً");

    public static readonly Error RoomAlreadyOccupied =
        Error.Conflict("Room.AlreadyOccupied", "الغرفة مشغولة");

    public static readonly Error RoomUnderMaintenance =
        Error.Conflict("Room.UnderMaintenance", "الغرفة تحت الصيانة ولا يمكن تسكينها");

    public static readonly Error RoomNotOccupied =
        Error.Conflict("Room.NotOccupied", "الغرفة غير مشغولة");

    public static readonly Error RoomHasActiveReservation =
        Error.Conflict("Room.HasActiveReservation", "The room has an active reservation. Check the guest out or cancel the reservation first.");

    public static readonly Error RoomOccupiedOnlyByCheckIn =
        Error.Validation("Room.OccupiedOnlyByCheckIn", "A room becomes occupied only through check-in.");

    public static readonly Error RoomInactive =
        Error.Conflict("Room.Inactive", "This room has been deactivated.");

    // Reservation errors
    public static readonly Error ReservationNotFound =
        Error.NotFound("Reservation.NotFound", "الحجز غير موجود");

    public static readonly Error ReservationNotActive =
        Error.Conflict("Reservation.NotActive", "الحجز غير نشط");

    public static readonly Error InvalidCheckoutDate =
        Error.Validation("Reservation.InvalidCheckoutDate", "تاريخ المغادرة يجب أن يكون بعد الوصول بليلة على الأقل");

    public static readonly Error InvalidExtendDate =
        Error.Validation("Reservation.InvalidExtendDate", "The new check-out date must be after the current check-out date.");

    // Contract errors
    public static readonly Error ContractNotFound =
        Error.NotFound("Contract.NotFound", "عقد الإيجار غير موجود");

    public static readonly Error ContractAlreadySigned =
        Error.Conflict("Contract.AlreadySigned", "لا يمكن إلغاء عقد موقّع");

    public static readonly Error ContractCancelled =
        Error.Conflict("Contract.Cancelled", "هذا العقد ملغى");

    public static readonly Error ContractAlreadyExecuted =
        Error.Conflict("Contract.AlreadyExecuted", "هذا العقد موقّع مسبقاً");

    public static readonly Error ContractAlreadyActive =
        Error.Conflict("Contract.AlreadyActive", "هذا العقد مفعّل مسبقاً");

    public static readonly Error ContractLocked =
        Error.Conflict("Contract.Locked", "لا يمكن تعديل عقد موقّع أو ملغى");
}
