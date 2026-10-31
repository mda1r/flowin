using ErrorOr;

namespace NexusPOS.Inventory.Domain;

public static class InventoryErrors
{
    public static readonly Error StockItemNotFound =
        Error.NotFound("Inventory.StockItemNotFound", "الصنف غير موجود في المخزون");

    public static readonly Error InsufficientStock =
        Error.Validation("Inventory.InsufficientStock", "الكمية في المخزون لا تكفي");

    public static readonly Error InvalidQuantity =
        Error.Validation("Inventory.InvalidQuantity", "الكمية يجب أن تكون أكبر من صفر");

    public static readonly Error NegativeReorderPoint =
        Error.Validation("Inventory.NegativeReorderPoint", "حد إعادة الطلب لا يمكن أن يكون سالباً");

    public static readonly Error StockCountNotFound =
        Error.NotFound("Inventory.StockCountNotFound", "الجرد غير موجود");

    public static readonly Error StockCountItemNotFound =
        Error.NotFound("Inventory.StockCountItemNotFound", "الصنف غير موجود في الجرد");

    public static readonly Error StockCountNotInProgress =
        Error.Validation("Inventory.StockCountNotInProgress", "الجرد غير جارٍ");

    public static readonly Error StockCountAlreadyCompleted =
        Error.Validation("Inventory.StockCountAlreadyCompleted", "تم إنهاء الجرد مسبقاً");
}
