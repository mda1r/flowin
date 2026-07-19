using ErrorOr;

namespace NexusPOS.POS.Domain;

public static class PosErrors
{
    public static readonly Error OrderNotFound =
        Error.NotFound("POS.OrderNotFound", "Order was not found.");

    public static readonly Error OrderNotOpen =
        Error.Conflict("POS.OrderNotOpen", "Order is not in an open state.");

    public static readonly Error OrderLineNotFound =
        Error.NotFound("POS.OrderLineNotFound", "Order line was not found.");

    public static readonly Error InvalidQuantity =
        Error.Validation("POS.InvalidQuantity", "Quantity must be greater than zero.");

    public static readonly Error InvalidDiscountValue =
        Error.Validation("POS.InvalidDiscountValue", "Discount value must not be negative.");

    public static readonly Error DiscountPercentageExceedsHundred =
        Error.Validation("POS.DiscountPercentageExceedsHundred", "Discount percentage cannot exceed 100%.");

    public static readonly Error InsufficientPayment =
        Error.Validation("POS.InsufficientPayment", "Payment amount is less than the order total.");

    public static readonly Error EmptyOrder =
        Error.Validation("POS.EmptyOrder", "Cannot complete an order with no line items.");

    public static readonly Error DuplicateVariant =
        Error.Conflict("POS.DuplicateVariant", "This variant is already on the order.");
}
