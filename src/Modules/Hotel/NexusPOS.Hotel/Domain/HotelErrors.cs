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

    // Reservation errors
    public static readonly Error ReservationNotFound =
        Error.NotFound("Reservation.NotFound", "الحجز غير موجود");

    public static readonly Error ReservationNotActive =
        Error.Conflict("Reservation.NotActive", "الحجز غير نشط");

    public static readonly Error InvalidCheckoutDate =
        Error.Validation("Reservation.InvalidCheckoutDate", "تاريخ المغادرة يجب أن يكون بعد الوصول بليلة على الأقل");

    // Contract errors
    public static readonly Error ContractNotFound =
        Error.NotFound("Contract.NotFound", "عقد الإيجار غير موجود");

    public static readonly Error ContractAlreadySigned =
        Error.Conflict("Contract.AlreadySigned", "لا يمكن إلغاء عقد موقّع");

    public static readonly Error ContractCancelled =
        Error.Conflict("Contract.Cancelled", "هذا العقد ملغى");
}
