namespace NexusPOS.Restaurant.Domain.Enums;

public enum RestaurantOrderStatus
{
    Pending = 1,
    InKitchen = 2,
    Ready = 3,
    Served = 4,
    Paid = 5,
    Cancelled = 6,
}
