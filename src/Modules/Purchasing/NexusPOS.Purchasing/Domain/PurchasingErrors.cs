using ErrorOr;

namespace NexusPOS.Purchasing.Domain;

public static class PurchasingErrors
{
    public static readonly Error SupplierNotFound =
        Error.NotFound("Purchasing.SupplierNotFound", "Supplier was not found.");

    public static readonly Error PurchaseOrderNotFound =
        Error.NotFound("Purchasing.PurchaseOrderNotFound", "Purchase order was not found.");

    public static readonly Error PurchaseOrderNotDraft =
        Error.Conflict("Purchasing.PurchaseOrderNotDraft", "Purchase order must be in Draft status.");

    public static readonly Error PurchaseOrderNotSent =
        Error.Conflict("Purchasing.PurchaseOrderNotSent", "Purchase order must be sent before receiving.");

    public static readonly Error PurchaseOrderAlreadyCompleted =
        Error.Conflict("Purchasing.PurchaseOrderAlreadyCompleted", "Purchase order has already been received or cancelled.");

    public static readonly Error PurchaseOrderLineNotFound =
        Error.NotFound("Purchasing.PurchaseOrderLineNotFound", "Purchase order line was not found.");

    public static readonly Error InvalidQuantity =
        Error.Validation("Purchasing.InvalidQuantity", "Quantity must be greater than zero.");

    public static readonly Error InvalidUnitCost =
        Error.Validation("Purchasing.InvalidUnitCost", "Unit cost must not be negative.");

    public static readonly Error EmptyPurchaseOrder =
        Error.Validation("Purchasing.EmptyPurchaseOrder", "Cannot send a purchase order with no lines.");

    public static readonly Error SupplierNameTaken =
        Error.Conflict("Purchasing.SupplierNameTaken", "A supplier with this name already exists.");
}
