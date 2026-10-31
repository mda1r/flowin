using ErrorOr;

namespace NexusPOS.Purchasing.Domain;

public static class PurchasingErrors
{
    public static readonly Error SupplierNotFound =
        Error.NotFound("Purchasing.SupplierNotFound", "المورد غير موجود");

    public static readonly Error PurchaseOrderNotFound =
        Error.NotFound("Purchasing.PurchaseOrderNotFound", "أمر الشراء غير موجود");

    public static readonly Error PurchaseOrderNotDraft =
        Error.Conflict("Purchasing.PurchaseOrderNotDraft", "أمر الشراء يجب أن يكون مسودة");

    public static readonly Error PurchaseOrderNotSent =
        Error.Conflict("Purchasing.PurchaseOrderNotSent", "أرسل أمر الشراء قبل الاستلام");

    public static readonly Error PurchaseOrderAlreadyCompleted =
        Error.Conflict("Purchasing.PurchaseOrderAlreadyCompleted", "أمر الشراء مستلم أو ملغى مسبقاً");

    public static readonly Error PurchaseOrderLineNotFound =
        Error.NotFound("Purchasing.PurchaseOrderLineNotFound", "البند غير موجود في أمر الشراء");

    public static readonly Error InvalidQuantity =
        Error.Validation("Purchasing.InvalidQuantity", "الكمية يجب أن تكون أكبر من صفر");

    public static readonly Error InvalidUnitCost =
        Error.Validation("Purchasing.InvalidUnitCost", "تكلفة الوحدة لا يمكن أن تكون سالبة");

    public static readonly Error EmptyPurchaseOrder =
        Error.Validation("Purchasing.EmptyPurchaseOrder", "لا يمكن إرسال أمر شراء فارغ");

    public static readonly Error SupplierNameTaken =
        Error.Conflict("Purchasing.SupplierNameTaken", "يوجد مورد بنفس الاسم");

    public static readonly Error PurchaseOrderNotReceived =
        Error.Validation("Purchasing.PurchaseOrderNotReceived", "لم يُستلم أمر الشراء بعد");

    public static readonly Error SupplierInactive =
        Error.Validation("Purchasing.SupplierInactive", "This supplier is inactive. Reactivate it before placing new orders.");

    public static readonly Error LineItemRequired =
        Error.Validation("Purchasing.LineItemRequired", "Specify exactly one of VariantId or StockMaterialId.");

    public static readonly Error StockMaterialNotFound =
        Error.Validation("Purchasing.StockMaterialNotFound", "المادة الخام غير موجودة في متجرك.");
}
