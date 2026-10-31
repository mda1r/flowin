using ErrorOr;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.Events;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.Domain.Entities;

public sealed class RestaurantOrder : AggregateRoot<RestaurantOrderId>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public int TableNumber { get; private set; }
    public RestaurantOrderStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public string? AppliedDiscountCode { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal SubTotal { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal Total { get; private set; }
    public string? PaymentMethod { get; private set; }
    public decimal? AmountTendered { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? ServedAt { get; private set; }
    public DateTime? PaidAt { get; private set; }

    // A copy of a sale already paid at the cafe till, kept only so the kitchen sees it. Its id is the POS
    // sale's, its lines are that sale's catalog items, and it never takes a payment here.
    public bool IsKitchenCopy { get; private set; }
    public string? CancelReason { get; private set; }
    public Guid? CancelledBy { get; private set; }
    public DateTime? CancelledAt { get; private set; }

    public List<RestaurantOrderItem> Items { get; private set; } = [];

    public const decimal VatRate = 0.15m;

    private RestaurantOrder() { }

    public static ErrorOr<RestaurantOrder> Create(
        Guid tenantId,
        Guid branchId,
        int tableNumber,
        IEnumerable<(Guid MenuItemId, string ItemName, int Quantity, decimal UnitPrice, string? Notes)> itemsData,
        string? notes,
        string? discountCode,
        decimal discountAmount,
        bool isKitchenCopy = false,
        Guid? id = null)
    {
        var items = itemsData.ToList();
        if (items.Count == 0)
        {
            return RestaurantErrors.EmptyOrder;
        }

        if (tableNumber <= 0)
        {
            return RestaurantErrors.InvalidTableNumber;
        }

        RestaurantOrder order = new RestaurantOrder
        {
            Id = new RestaurantOrderId(id ?? Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            TableNumber = tableNumber,
            Status = RestaurantOrderStatus.Pending,
            Notes = notes?.Trim(),
            AppliedDiscountCode = discountCode?.Trim().ToUpperInvariant(),
            DiscountAmount = discountAmount,
            IsKitchenCopy = isKitchenCopy,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = items.Select(i =>
                RestaurantOrderItem.Create(i.MenuItemId, i.ItemName, i.Quantity, i.UnitPrice, i.Notes)).ToList(),
        };
        order.RecalculateTotals();

        order.RaiseDomainEvent(new RestaurantOrderCreatedDomainEvent(
            order.Id.Value, tenantId, branchId, tableNumber));

        return order;
    }

    // Menu prices include VAT, as on the cafe menu: the customer pays the listed price less any discount,
    // and the VAT is the share of that total. The discount never exceeds what is left on the bill.
    private void RecalculateTotals()
    {
        SubTotal = Math.Round(Items.Sum(i => i.UnitPrice * i.Quantity), 4);
        DiscountAmount = Math.Min(DiscountAmount, SubTotal);
        Total = Math.Round(SubTotal - DiscountAmount, 4);
        TaxAmount = Math.Round(Total * VatRate / (1 + VatRate), 4);
    }

    // A further round for a table that already has an open order. Once the order has reached the kitchen,
    // the new lines go there too, so a ready or served order is back in the kitchen until they are done.
    public ErrorOr<IReadOnlyList<RestaurantOrderItem>> AddItems(
        IEnumerable<(Guid MenuItemId, string ItemName, int Quantity, decimal UnitPrice, string? Notes)> itemsData)
    {
        if (Status is RestaurantOrderStatus.Paid or RestaurantOrderStatus.Cancelled || IsKitchenCopy)
        {
            return RestaurantErrors.OrderNotModifiable;
        }

        List<RestaurantOrderItem> added =
        [
            .. itemsData.Select(i => RestaurantOrderItem.Create(i.MenuItemId, i.ItemName, i.Quantity, i.UnitPrice, i.Notes)),
        ];
        if (added.Count == 0)
        {
            return RestaurantErrors.EmptyOrder;
        }

        Items.AddRange(added);
        RecalculateTotals();
        UpdatedAt = DateTime.UtcNow;

        if (Status is RestaurantOrderStatus.Ready or RestaurantOrderStatus.Served)
        {
            Status = RestaurantOrderStatus.InKitchen;
            RaiseDomainEvent(new OrderSentToKitchenDomainEvent(Id.Value, TenantId, BranchId, TableNumber));
        }

        return added;
    }

    // Voids one line the kitchen has not finished. A ready line has been cooked, and the last line can only
    // go by cancelling the whole order, so a reason is recorded.
    public ErrorOr<RestaurantOrderItem> RemoveItem(RestaurantOrderItemId itemId)
    {
        if (Status is RestaurantOrderStatus.Paid or RestaurantOrderStatus.Cancelled)
        {
            return RestaurantErrors.OrderNotModifiable;
        }

        RestaurantOrderItem? item = Items.Find(i => i.Id == itemId);
        if (item is null)
        {
            return RestaurantErrors.OrderItemNotFound;
        }

        if (item.Status == OrderItemStatus.Ready)
        {
            return RestaurantErrors.OrderItemAlreadyReady;
        }

        if (Items.Count == 1)
        {
            return RestaurantErrors.LastOrderItem;
        }

        Items.Remove(item);
        RecalculateTotals();
        UpdatedAt = DateTime.UtcNow;
        return item;
    }

    public ErrorOr<Success> SendToKitchen()
    {
        if (Status != RestaurantOrderStatus.Pending)
        {
            return RestaurantErrors.OrderNotPending;
        }

        Status = RestaurantOrderStatus.InKitchen;
        UpdatedAt = DateTime.UtcNow;

        RaiseDomainEvent(new OrderSentToKitchenDomainEvent(
            Id.Value, TenantId, BranchId, TableNumber));

        return Result.Success;
    }

    public ErrorOr<Success> MarkItemReady(RestaurantOrderItemId itemId)
    {
        if (Status is RestaurantOrderStatus.Paid or RestaurantOrderStatus.Cancelled)
        {
            return RestaurantErrors.OrderNotModifiable;
        }

        var item = Items.Find(i => i.Id == itemId);
        if (item is null)
        {
            return RestaurantErrors.OrderItemNotFound;
        }

        item.MarkReady();
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> MarkReady()
    {
        if (Status != RestaurantOrderStatus.InKitchen)
        {
            return RestaurantErrors.OrderNotInKitchen;
        }

        Status = RestaurantOrderStatus.Ready;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> ReturnToKitchen()
    {
        if (Status != RestaurantOrderStatus.Ready)
        {
            return RestaurantErrors.OrderNotReady;
        }

        Status = RestaurantOrderStatus.InKitchen;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Serve()
    {
        if (Status != RestaurantOrderStatus.Ready)
        {
            return RestaurantErrors.OrderNotReady;
        }

        Status = RestaurantOrderStatus.Served;
        ServedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    // menuItemIds: which order items are real menu items. Orders mirrored from the cafe cashier for the kitchen
    // reuse catalog ids that the POS sale already deducted, so only genuine menu items count as recipe sales.
    public ErrorOr<Success> Pay(string paymentMethod, decimal amountTendered, IReadOnlySet<Guid> menuItemIds)
    {
        if (IsKitchenCopy)
        {
            return RestaurantErrors.KitchenCopyNotPayable;
        }

        if (Status == RestaurantOrderStatus.Paid)
        {
            return RestaurantErrors.OrderAlreadyPaid;
        }

        if (Status == RestaurantOrderStatus.Cancelled)
        {
            return RestaurantErrors.OrderAlreadyCancelled;
        }

        if (amountTendered < Total)
        {
            return RestaurantErrors.InsufficientPayment;
        }

        Status = RestaurantOrderStatus.Paid;
        PaymentMethod = paymentMethod;
        AmountTendered = amountTendered;
        PaidAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;

        List<RecipeItemsSoldDomainEvent.Line> recipeLines =
        [
            .. Items
                .Where(i => menuItemIds.Contains(i.MenuItemId))
                .Select(i => new RecipeItemsSoldDomainEvent.Line(i.MenuItemId, i.Quantity)),
        ];
        if (recipeLines.Count > 0)
        {
            RaiseDomainEvent(new RecipeItemsSoldDomainEvent(TenantId, Id.Value, recipeLines));
        }

        return Result.Success;
    }

    public ErrorOr<Success> Cancel(string reason, Guid? cancelledBy)
    {
        if (Status == RestaurantOrderStatus.Paid)
        {
            return RestaurantErrors.OrderAlreadyPaid;
        }

        if (Status == RestaurantOrderStatus.Cancelled)
        {
            return RestaurantErrors.OrderAlreadyCancelled;
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return RestaurantErrors.CancelReasonRequired;
        }

        Status = RestaurantOrderStatus.Cancelled;
        CancelReason = reason.Trim();
        CancelledBy = cancelledBy;
        CancelledAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }
}
