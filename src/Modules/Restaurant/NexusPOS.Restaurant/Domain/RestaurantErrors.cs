using ErrorOr;

namespace NexusPOS.Restaurant.Domain;

public static class RestaurantErrors
{
    // ── Menu ────────────────────────────────────────────────────────────────
    public static readonly Error MenuItemNotFound =
        Error.NotFound("MenuItem.NotFound", "Menu item not found.");

    public static readonly Error InvalidPrice =
        Error.Validation("MenuItem.InvalidPrice", "Price must be greater than zero.");

    // ── Restaurant Orders ────────────────────────────────────────────────────
    public static readonly Error OrderNotFound =
        Error.NotFound("RestaurantOrder.NotFound", "Restaurant order not found.");

    public static readonly Error EmptyOrder =
        Error.Validation("RestaurantOrder.Empty", "Order must contain at least one item.");

    public static readonly Error InvalidTableNumber =
        Error.Validation("RestaurantOrder.InvalidTableNumber", "Table number must be greater than zero.");

    public static readonly Error OrderNotPending =
        Error.Conflict("RestaurantOrder.NotPending", "Order must be in Pending status to send to kitchen.");

    public static readonly Error OrderNotInKitchen =
        Error.Conflict("RestaurantOrder.NotInKitchen", "Order must be in InKitchen status to mark as ready.");

    public static readonly Error OrderNotReady =
        Error.Conflict("RestaurantOrder.NotReady", "Order must be in Ready status to serve.");

    public static readonly Error OrderNotModifiable =
        Error.Conflict("RestaurantOrder.NotModifiable", "Order cannot be modified in its current status.");

    public static readonly Error OrderAlreadyPaid =
        Error.Conflict("RestaurantOrder.AlreadyPaid", "Order has already been paid.");

    public static readonly Error OrderAlreadyCancelled =
        Error.Conflict("RestaurantOrder.AlreadyCancelled", "Order has already been cancelled.");

    public static readonly Error InsufficientPayment =
        Error.Validation("RestaurantOrder.InsufficientPayment", "Payment amount is less than the order total.");

    public static readonly Error OrderItemNotFound =
        Error.NotFound("RestaurantOrderItem.NotFound", "Order item not found.");

    // ── Discount Codes ───────────────────────────────────────────────────────
    public static readonly Error DiscountCodeNotFound =
        Error.NotFound("DiscountCode.NotFound", "Discount code not found.");

    public static readonly Error InvalidDiscountCode =
        Error.Validation("DiscountCode.InvalidCode", "Discount code cannot be empty.");

    public static readonly Error InvalidDiscountValue =
        Error.Validation("DiscountCode.InvalidValue", "Discount value must be greater than zero.");

    public static readonly Error DiscountPercentageExceedsHundred =
        Error.Validation("DiscountCode.PercentageExceedsHundred", "Percentage discount cannot exceed 100%.");

    public static readonly Error DiscountCodeInactive =
        Error.Validation("DiscountCode.Inactive", "This discount code is no longer active.");

    public static readonly Error DiscountCodeExpired =
        Error.Validation("DiscountCode.Expired", "This discount code has expired.");

    public static readonly Error DiscountCodeMaxUsesReached =
        Error.Validation("DiscountCode.MaxUsesReached", "This discount code has reached its maximum usage limit.");

    public static readonly Error DiscountCodeMinOrderAmountNotMet =
        Error.Validation("DiscountCode.MinOrderAmountNotMet", "Order amount does not meet the minimum required for this code.");
}
