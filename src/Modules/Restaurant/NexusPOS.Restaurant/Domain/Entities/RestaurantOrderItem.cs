using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Restaurant.Domain.Entities;

public sealed class RestaurantOrderItem : Entity<RestaurantOrderItemId>
{
    public Guid MenuItemId { get; private set; }
    public string ItemName { get; private set; } = string.Empty;
    public int Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public string? Notes { get; private set; }
    public OrderItemStatus Status { get; private set; }

    public decimal LineTotal => Math.Round(UnitPrice * Quantity, 4);

    private RestaurantOrderItem() { }

    internal static RestaurantOrderItem Create(
        Guid menuItemId,
        string itemName,
        int quantity,
        decimal unitPrice,
        string? notes)
    {
        return new RestaurantOrderItem
        {
            Id = new RestaurantOrderItemId(Guid.NewGuid()),
            MenuItemId = menuItemId,
            ItemName = itemName.Trim(),
            Quantity = quantity,
            UnitPrice = unitPrice,
            Notes = notes?.Trim(),
            Status = OrderItemStatus.Pending,
        };
    }

    internal void MarkPreparing() => Status = OrderItemStatus.Preparing;

    internal void MarkReady() => Status = OrderItemStatus.Ready;
}
