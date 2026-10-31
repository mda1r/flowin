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

    public static readonly Error StockItemHasHistory =
        Error.Conflict("Inventory.StockItemHasHistory", "Stock item still has quantity or movement history; archive it instead.");

    public static readonly Error StockItemArchived =
        Error.Conflict("Inventory.StockItemArchived", "Stock item is archived; a manager must restore it first.");

    public static readonly Error StockCountNotFound =
        Error.NotFound("Inventory.StockCountNotFound", "الجرد غير موجود");

    public static readonly Error StockCountItemNotFound =
        Error.NotFound("Inventory.StockCountItemNotFound", "الصنف غير موجود في الجرد");

    public static readonly Error StockCountNotInProgress =
        Error.Validation("Inventory.StockCountNotInProgress", "الجرد غير جارٍ");

    public static readonly Error StockCountAlreadyCompleted =
        Error.Validation("Inventory.StockCountAlreadyCompleted", "تم إنهاء الجرد مسبقاً");

    public static readonly Error MaterialArchived =
        Error.Conflict("Inventory.MaterialArchived", "هذه المادة مؤرشفة. استرجعها من الأرشيف أولاً.");
    public static readonly Error StockCountOpenExists =
        Error.Conflict("Inventory.StockCountOpenExists", "يوجد جرد مفتوح لهذا الفرع");

    public static readonly Error InvalidStockCountType =
        Error.Validation("Inventory.InvalidStockCountType", "نوع الجرد غير صالح");

    public static readonly Error StockCountNoItems =
        Error.Validation("Inventory.StockCountNoItems", "لا توجد أصناف في مخزون هذا الفرع لجردها");
}
