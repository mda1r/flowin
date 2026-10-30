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
    public OrderSource Source { get; private set; } = OrderSource.Pos;
    public Guid? SourceReferenceId { get; private set; }

    // Set by the till for one-shot checkout; unique, so a sale resent after a dropped connection is recorded once.
    public Guid? ClientReference { get; private set; }

    // When the till rang the sale up while offline; the order itself is created when the sale syncs.
    public DateTime? OfflineCreatedAt { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public OrderStatus Status { get; private set; }
    public Discount OrderDiscount { get; private set; } = Discount.None();
    public decimal TaxRate { get; private set; }
    public decimal SubtotalAmount { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public int LoyaltyPointsRedeemed { get; private set; }
    public decimal LoyaltyDiscountAmount { get; private set; }

    // The store's riyal value per point when the points were redeemed, so later changes to the programme
    // never reprice an order that is already open.
    public decimal LoyaltyPointValue { get; private set; } = LoyaltyRules.Default.ValuePerPoint;
    public decimal TaxAmount { get; private set; }
    public decimal TotalAmount { get; private set; }
    public PaymentMethod? PaymentMethod { get; private set; }
    public decimal? AmountTendered { get; private set; }
    public decimal? ChangeDue { get; private set; }
    public decimal? SplitCash { get; private set; }
    public decimal? SplitCard { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    // The store's sequential invoice number (1, 2, 3…), given when the sale completes and printed on the receipt.
    public long? Number { get; private set; }

    public void AssignNumber(long number)
    {
        if (Number is null && Status == OrderStatus.Open)
        {
            Number = number;
        }
    }

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

    // A sale paid outside the POS (gaming session, restaurant order), recorded so shifts, reports and ZATCA see it.
    public static Order CreateExternal(
        Guid tenantId, Guid branchId, string currency, decimal taxRate, OrderSource source, Guid sourceReferenceId)
    {
        Order order = Create(tenantId, branchId, currency, null, taxRate);
        order.Source = source;
        order.SourceReferenceId = sourceReferenceId;
        return order;
    }

    public void TagClientReference(Guid clientReference, DateTime? offlineCreatedAt)
    {
        ClientReference = clientReference;
        OfflineCreatedAt = offlineCreatedAt;
    }

    public ErrorOr<OrderLine> AddLine(
        Guid variantId,
        string productName,
        string variantName,
        decimal unitPriceAmount,
        decimal costPrice,
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
        OrderLine line = OrderLine.Create(variantId, productName, variantName, unitPrice, costPrice, quantity, lineDiscount);
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

    // Redeems points as a discount that lowers the amount paid by exactly their value (VAT included).
    // Zero points clears the redemption.
    public ErrorOr<Success> RedeemLoyaltyPoints(int points, decimal valuePerPoint)
    {
        if (Status != OrderStatus.Open)
        {
            return PosErrors.OrderNotOpen;
        }

        if (CustomerId is null)
        {
            return PosErrors.LoyaltyRequiresCustomer;
        }

        if (points < 0 || valuePerPoint <= 0)
        {
            return PosErrors.InvalidLoyaltyPoints;
        }

        decimal grossBeforeLoyalty = (SubtotalAmount - OrderDiscount.ComputeAmount(SubtotalAmount)) * (1 + TaxRate);
        if (LoyaltyRules.ValueOf(points, valuePerPoint) > Math.Round(grossBeforeLoyalty, 2))
        {
            return PosErrors.LoyaltyExceedsTotal;
        }

        LoyaltyPointsRedeemed = points;
        LoyaltyPointValue = valuePerPoint;
        RecalculateTotals();
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Complete(Enums.PaymentMethod method, decimal amountTendered, decimal? cashAmount = null, decimal? cardAmount = null)
    {
        if (Status != OrderStatus.Open)
        {
            return PosErrors.OrderNotOpen;
        }

        if (Lines.Count == 0)
        {
            return PosErrors.EmptyOrder;
        }

        if (Math.Round(amountTendered, 2) < Math.Round(TotalAmount, 2))
        {
            return PosErrors.InsufficientPayment;
        }

        Status = OrderStatus.Completed;
        PaymentMethod = method;
        AmountTendered = amountTendered;
        ChangeDue = Math.Round(amountTendered - TotalAmount, 4);
        if (method == Enums.PaymentMethod.Split)
        {
            SplitCash = cashAmount;
            SplitCard = cardAmount;
        }
        CompletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;

        var lineItems = Lines
            .Select(l => new OrderCompletedDomainEvent.LineItem(l.VariantId, l.Quantity))
            .ToList();
        RaiseDomainEvent(new OrderCompletedDomainEvent(
            Id.Value, TenantId, BranchId,
            SubtotalAmount, DiscountAmount, TaxAmount, TotalAmount, Currency, method, lineItems,
            CustomerId, LoyaltyPointsRedeemed, Source, Number));
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
        decimal manualDiscount = Math.Round(OrderDiscount.ComputeAmount(SubtotalAmount), 4);
        decimal room = Math.Max(SubtotalAmount - manualDiscount, 0m);

        // Removing lines can shrink the bill below the redeemed value; give back the points that no longer fit.
        if (PreTaxLoyalty(LoyaltyPointsRedeemed) > room)
        {
            LoyaltyPointsRedeemed = (int)Math.Floor(room * (1 + TaxRate) / LoyaltyPointValue);
            while (LoyaltyPointsRedeemed > 0 && PreTaxLoyalty(LoyaltyPointsRedeemed) > room)
            {
                LoyaltyPointsRedeemed--;
            }
        }

        LoyaltyDiscountAmount = PreTaxLoyalty(LoyaltyPointsRedeemed);
        DiscountAmount = manualDiscount + LoyaltyDiscountAmount;
        decimal taxable = SubtotalAmount - DiscountAmount;
        TaxAmount = Math.Round(taxable * TaxRate, 4);
        TotalAmount = Math.Round(taxable + TaxAmount, 4);
    }

    private decimal PreTaxLoyalty(int points) => Math.Round(LoyaltyRules.ValueOf(points, LoyaltyPointValue) / (1 + TaxRate), 4);
}
