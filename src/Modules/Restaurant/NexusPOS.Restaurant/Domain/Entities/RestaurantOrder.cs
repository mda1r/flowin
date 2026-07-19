using ErrorOr;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.Events;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

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

    public List<RestaurantOrderItem> Items { get; private set; } = [];

    private const decimal TaxRate = 0.15m;

    private RestaurantOrder() { }

    public static ErrorOr<RestaurantOrder> Create(
        Guid tenantId,
        Guid branchId,
        int tableNumber,
        IEnumerable<(Guid MenuItemId, string ItemName, int Quantity, decimal UnitPrice, string? Notes)> itemsData,
        string? notes,
        string? discountCode,
        decimal discountAmount)
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

        decimal subTotal = Math.Round(items.Sum(i => i.UnitPrice * i.Quantity), 4);
        decimal effectiveDiscount = Math.Min(discountAmount, subTotal);
        decimal taxable = subTotal - effectiveDiscount;
        decimal taxAmount = Math.Round(taxable * TaxRate, 4);
        decimal total = Math.Round(taxable + taxAmount, 4);

        RestaurantOrder order = new RestaurantOrder
        {
            Id = new RestaurantOrderId(Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            TableNumber = tableNumber,
            Status = RestaurantOrderStatus.Pending,
            Notes = notes?.Trim(),
            AppliedDiscountCode = discountCode?.Trim().ToUpperInvariant(),
            DiscountAmount = effectiveDiscount,
            SubTotal = subTotal,
            TaxAmount = taxAmount,
            Total = total,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = items.Select(i =>
                RestaurantOrderItem.Create(i.MenuItemId, i.ItemName, i.Quantity, i.UnitPrice, i.Notes)).ToList(),
        };

        order.RaiseDomainEvent(new RestaurantOrderCreatedDomainEvent(
            order.Id.Value, tenantId, branchId, tableNumber));

        return order;
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

    public ErrorOr<Success> Pay(string paymentMethod, decimal amountTendered)
    {
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
        return Result.Success;
    }

    public ErrorOr<Success> Cancel()
    {
        if (Status == RestaurantOrderStatus.Paid)
        {
            return RestaurantErrors.OrderAlreadyPaid;
        }

        if (Status == RestaurantOrderStatus.Cancelled)
        {
            return RestaurantErrors.OrderAlreadyCancelled;
        }

        Status = RestaurantOrderStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }
}
