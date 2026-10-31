using ErrorOr;

namespace NexusPOS.Catalog.Domain;

public static class CatalogErrors
{
    public static readonly Error CategoryNotFound =
        Error.NotFound("Catalog.CategoryNotFound", "التصنيف غير موجود");

    public static readonly Error CategoryNameExists =
        Error.Conflict("Catalog.CategoryNameExists", "يوجد تصنيف بنفس الاسم");

    public static readonly Error ProductNotFound =
        Error.NotFound("Catalog.ProductNotFound", "المنتج غير موجود");

    public static readonly Error SkuAlreadyExists =
        Error.Conflict("Catalog.SkuAlreadyExists", "يوجد منتج آخر بنفس رمز SKU");

    public static readonly Error ProductInactive =
        Error.Forbidden("Catalog.ProductInactive", "هذا المنتج موقوف");

    public static readonly Error VariantNotFound =
        Error.NotFound("Catalog.VariantNotFound", "خيار المنتج غير موجود");

    public static readonly Error BarcodeAlreadyExists =
        Error.Conflict("Catalog.BarcodeAlreadyExists", "Another product already uses this barcode.");

    public static readonly Error LastActiveVariant =
        Error.Conflict("Catalog.LastActiveVariant", "A product needs at least one active variant; deactivate the product instead.");

    public static readonly Error InvalidPrice =
        Error.Validation("Catalog.InvalidPrice", "السعر لا يمكن أن يكون سالباً");

    public static readonly Error ModifierGroupNotFound =
        Error.NotFound("Catalog.ModifierGroupNotFound", "مجموعة الإضافات غير موجودة");

    public static readonly Error ModifierGroupNameExists =
        Error.Conflict("Catalog.ModifierGroupNameExists", "توجد مجموعة إضافات بنفس الاسم");

    public static readonly Error ModifierGroupNameRequired =
        Error.Validation("Catalog.ModifierGroupNameRequired", "اسم المجموعة مطلوب");

    public static readonly Error ModifierMinNegative =
        Error.Validation("Catalog.ModifierMinNegative", "الحد الأدنى لا يمكن أن يكون سالباً");

    public static readonly Error ModifierMaxTooSmall =
        Error.Validation("Catalog.ModifierMaxTooSmall", "الحد الأعلى يجب أن يكون 1 على الأقل");

    public static readonly Error ModifierMinAboveMax =
        Error.Validation("Catalog.ModifierMinAboveMax", "الحد الأدنى لا يمكن أن يتجاوز الحد الأعلى");

    public static readonly Error ModifierRequiredNeedsMin =
        Error.Validation("Catalog.ModifierRequiredNeedsMin", "المجموعة الإلزامية تحتاج حداً أدنى 1 على الأقل");

    public static readonly Error ModifierMinNeedsRequired =
        Error.Validation("Catalog.ModifierMinNeedsRequired", "اجعل المجموعة إلزامية أو اجعل الحد الأدنى صفراً");

    public static readonly Error ModifierNoOptions =
        Error.Validation("Catalog.ModifierNoOptions", "أضف خياراً واحداً على الأقل");

    public static readonly Error ModifierTooManyOptions =
        Error.Validation("Catalog.ModifierTooManyOptions", "عدد الخيارات كبير، الحد 50 خياراً");

    public static readonly Error ModifierOptionNameRequired =
        Error.Validation("Catalog.ModifierOptionNameRequired", "اسم الخيار مطلوب");

    public static readonly Error ModifierPriceNegative =
        Error.Validation("Catalog.ModifierPriceNegative", "سعر الإضافة لا يمكن أن يكون سالباً");

    public static readonly Error ModifierOptionDuplicate =
        Error.Validation("Catalog.ModifierOptionDuplicate", "يوجد خيار مكرر في المجموعة");

    public static readonly Error ModifierMinAboveOptions =
        Error.Validation("Catalog.ModifierMinAboveOptions", "الحد الأدنى أكبر من عدد الخيارات المفعّلة");

    public static readonly Error ModifierGroupInactive =
        Error.Conflict("Catalog.ModifierGroupInactive", "مجموعة الإضافات موقوفة");

    public static readonly Error NoTenant =
        Error.Unauthorized("Catalog.NoTenant", "انتهت الجلسة، سجّل الدخول مرة أخرى");
}
