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
}
