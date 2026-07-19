using ErrorOr;

namespace NexusPOS.Inventory.Domain;

public static class InventoryErrors
{
    public static readonly Error StockItemNotFound =
        Error.NotFound("Inventory.StockItemNotFound", "Stock item was not found.");

    public static readonly Error InsufficientStock =
        Error.Validation("Inventory.InsufficientStock", "Insufficient stock for this operation.");

    public static readonly Error InvalidQuantity =
        Error.Validation("Inventory.InvalidQuantity", "Quantity must be greater than zero.");

    public static readonly Error NegativeReorderPoint =
        Error.Validation("Inventory.NegativeReorderPoint", "Reorder point must not be negative.");
}
