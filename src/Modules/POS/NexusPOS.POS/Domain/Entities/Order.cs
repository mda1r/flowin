using ErrorOr;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.ValueObjects;

namespace NexusPOS.POS.Domain.Entities;

public sealed class Order : AggregateRoot<OrderId>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? CustomerId { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public OrderStatus Status { get; private set; }
    public Discount OrderDiscount { get; private set; } = Discount.None();
    public decimal TaxRate { get; private set; }
    public decimal SubtotalAmount { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal TotalAmount { get; private set; }
    public PaymentMethod? PaymentMethod { get; private set; }
    public decimal? AmountTendered { get; private set; }
    public decimal? ChangeDue { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    public List<OrderLine> Lines { get; private set; } = [];

    private Order() { }

    public static Order Create(Guid tenantId, Guid branchId, string currency, Guid? customerId = null, decimal taxRate = 0m)
    {
        Order order = new()
        {
            Id = new OrderId(Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            Currency = currency.ToUpperInvariant(),
            CustomerId = customerId,
            Status = OrderStatus.Open,
            TaxRate = taxRate < 0 ? 0m : taxRate,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        order.RaiseDomainEvent(new OrderCreatedDomainEvent(order.Id.Value, tenantId, branchId));
        return order;
    }

    public ErrorOr<OrderLine> AddLine(
        Guid variantId,
        string productName,
        string variantName,
        decimal unitPriceAmount,
        decimal quantity,
        Discount? lineDiscount = null)
    {
        if (Status != OrderStatus.Open)
        {
            return PosErrors.OrderNotOpen;
        }

        if (quantity <= 0)
        {
            return PosErrors.InvalidQuantity;
        }

        OrderLine? existing = Lines.Find(l => l.VariantId == variantId);
        if (existing is not null)
        {
            existing.UpdateQuantity(existing.Quantity + quantity);
            RecalculateTotals();
            UpdatedAt = DateTime.UtcNow;
            return existing;
        }

        Money unitPrice = Money.Of(unitPriceAmount, Currency);
        OrderLine line = OrderLine.Create(variantId, productName, variantName, unitPrice, quantity, lineDiscount);
        Lines.Add(line);
        RecalculateTotals();
        UpdatedAt = DateTime.UtcNow;
        return line;
    }

    public ErrorOr<Success> RemoveLine(OrderLineId lineId)
    {
        if (Status != OrderStatus.Open)
        {
            return PosErrors.OrderNotOpen;
        }

        OrderLine? line = Lines.Find(l => l.Id == lineId);
        if (line is null)
        {
            return PosErrors.OrderLineNotFound;
        }

        Lines.Remove(line);
        RecalculateTotals();
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> ApplyDiscount(DiscountType type, decimal value)
    {
        if (Status != OrderStatus.Open)
        {
            return PosErrors.OrderNotOpen;
        }

        ErrorOr<Discount> discountResult = Discount.Create(type, value);
        if (discountResult.IsError)
        {
            return discountResult.Errors;
        }

        OrderDiscount = discountResult.Value;
        RecalculateTotals();
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Complete(Enums.PaymentMethod method, decimal amountTendered)
    {
        if (Status != OrderStatus.Open)
        {
            return PosErrors.OrderNotOpen;
        }

        if (Lines.Count == 0)
        {
            return PosErrors.EmptyOrder;
        }

        if (amountTendered < TotalAmount)
        {
            return PosErrors.InsufficientPayment;
        }

        Status = OrderStatus.Completed;
        PaymentMethod = method;
        AmountTendered = amountTendered;
        ChangeDue = Math.Round(amountTendered - TotalAmount, 4);
        CompletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;

        RaiseDomainEvent(new OrderCompletedDomainEvent(
            Id.Value, TenantId, BranchId,
            SubtotalAmount, DiscountAmount, TaxAmount, TotalAmount, Currency, method));
        return Result.Success;
    }

    public ErrorOr<Success> Cancel(string? reason = null)
    {
        if (Status != OrderStatus.Open)
        {
            return PosErrors.OrderNotOpen;
        }

        Status = OrderStatus.Cancelled;
        Notes = reason?.Trim();
        UpdatedAt = DateTime.UtcNow;

        RaiseDomainEvent(new OrderCancelledDomainEvent(Id.Value, TenantId, BranchId, reason));
        return Result.Success;
    }

    private void RecalculateTotals()
    {
        SubtotalAmount = Lines.Sum(l => l.LineTotal);
        DiscountAmount = Math.Round(OrderDiscount.ComputeAmount(SubtotalAmount), 4);
        decimal taxable = SubtotalAmount - DiscountAmount;
        TaxAmount = Math.Round(taxable * TaxRate, 4);
        TotalAmount = Math.Round(taxable + TaxAmount, 4);
    }
}
