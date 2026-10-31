using ErrorOr;

namespace NexusPOS.Catalog.Domain;

public static class CatalogErrors
{
    public static readonly Error CategoryNotFound =
        Error.NotFound("Catalog.CategoryNotFound", "Category was not found.");

    public static readonly Error CategoryNameExists =
        Error.Conflict("Catalog.CategoryNameExists", "A category with this name already exists.");

    public static readonly Error ProductNotFound =
        Error.NotFound("Catalog.ProductNotFound", "Product was not found.");

    public static readonly Error SkuAlreadyExists =
        Error.Conflict("Catalog.SkuAlreadyExists", "A product variant with this SKU already exists.");

    public static readonly Error ProductInactive =
        Error.Forbidden("Catalog.ProductInactive", "This product has been deactivated.");

    public static readonly Error VariantNotFound =
        Error.NotFound("Catalog.VariantNotFound", "Product variant was not found.");

    public static readonly Error InvalidPrice =
        Error.Validation("Catalog.InvalidPrice", "Price must be a non-negative value.");
}
