using ErrorOr;
using FluentAssertions;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class OrderTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();
    private static readonly Guid _variantId = Guid.NewGuid();

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithValidArgs_CreatesOpenOrderWithEvent()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");

        order.TenantId.Should().Be(_tenantId);
        order.BranchId.Should().Be(_branchId);
        order.Currency.Should().Be("USD");
        order.Status.Should().Be(OrderStatus.Open);
        order.Lines.Should().BeEmpty();
        order.TotalAmount.Should().Be(0m);
        order.DomainEvents.Should().ContainSingle(e => e is OrderCreatedDomainEvent);
    }

    [Fact]
    public void Create_NormalizesLowercaseCurrency()
    {
        Order order = Order.Create(_tenantId, _branchId, "sar");

        order.Currency.Should().Be("SAR");
    }

    // ── AddLine ───────────────────────────────────────────────────────────────

    [Fact]
    public void AddLine_ValidItem_AddsLineAndRecalculatesTotals()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");

        ErrorOr<OrderLine> result = order.AddLine(_variantId, "Widget", "Red", 10m, 3m);

        result.IsError.Should().BeFalse();
        order.Lines.Should().ContainSingle();
        order.SubtotalAmount.Should().Be(30m);
        order.TotalAmount.Should().Be(30m);
    }

    [Fact]
    public void AddLine_SameVariant_AccumulatesQuantity()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");
        order.AddLine(_variantId, "Widget", "Red", 10m, 2m);

        order.AddLine(_variantId, "Widget", "Red", 10m, 3m);

        order.Lines.Should().ContainSingle();
        order.Lines[0].Quantity.Should().Be(5m);
        order.SubtotalAmount.Should().Be(50m);
    }

    [Fact]
    public void AddLine_ZeroQuantity_ReturnsError()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");

        ErrorOr<OrderLine> result = order.AddLine(_variantId, "Widget", "Red", 10m, 0m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PosErrors.InvalidQuantity);
    }

    [Fact]
    public void AddLine_ToCompletedOrder_ReturnsOrderNotOpenError()
    {
        Order order = CreateCompletedOrder();

        ErrorOr<OrderLine> result = order.AddLine(Guid.NewGuid(), "Widget", "Red", 10m, 1m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PosErrors.OrderNotOpen);
    }

    // ── RemoveLine ────────────────────────────────────────────────────────────

    [Fact]
    public void RemoveLine_ExistingLine_RemovesAndRecalculates()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");
        ErrorOr<OrderLine> addResult = order.AddLine(_variantId, "Widget", "Red", 10m, 2m);
        OrderLineId lineId = addResult.Value.Id;

        ErrorOr<Success> result = order.RemoveLine(lineId);

        result.IsError.Should().BeFalse();
        order.Lines.Should().BeEmpty();
        order.SubtotalAmount.Should().Be(0m);
    }

    [Fact]
    public void RemoveLine_NonExistentLine_ReturnsError()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");

        ErrorOr<Success> result = order.RemoveLine(new OrderLineId(Guid.NewGuid()));

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PosErrors.OrderLineNotFound);
    }

    // ── ApplyDiscount ─────────────────────────────────────────────────────────

    [Fact]
    public void ApplyDiscount_TenPercent_ReducesTotalCorrectly()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");
        order.AddLine(_variantId, "Widget", "Red", 100m, 1m);

        ErrorOr<Success> result = order.ApplyDiscount(DiscountType.Percentage, 10m);

        result.IsError.Should().BeFalse();
        order.DiscountAmount.Should().Be(10m);
        order.TotalAmount.Should().Be(90m);
    }

    [Fact]
    public void ApplyDiscount_Fixed50_ReducesTotalCorrectly()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");
        order.AddLine(_variantId, "Widget", "Red", 200m, 1m);

        order.ApplyDiscount(DiscountType.Fixed, 50m);

        order.DiscountAmount.Should().Be(50m);
        order.TotalAmount.Should().Be(150m);
    }

    [Fact]
    public void ApplyDiscount_InvalidPercentage_ReturnsError()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");

        ErrorOr<Success> result = order.ApplyDiscount(DiscountType.Percentage, 150m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PosErrors.DiscountPercentageExceedsHundred);
    }

    // ── Tax ───────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithTaxRate_TaxIsIncludedInTotal()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD", taxRate: 15m);
        order.AddLine(_variantId, "Widget", "Red", 100m, 1m);

        order.TaxAmount.Should().Be(15m);
        order.TotalAmount.Should().Be(115m);
    }

    // ── Complete ──────────────────────────────────────────────────────────────

    [Fact]
    public void Complete_WithSufficientPayment_CompletesOrderAndRaisesEvent()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");
        order.AddLine(_variantId, "Widget", "Red", 50m, 2m);
        order.ClearDomainEvents();

        ErrorOr<Success> result = order.Complete(PaymentMethod.Cash, 100m);

        result.IsError.Should().BeFalse();
        order.Status.Should().Be(OrderStatus.Completed);
        order.PaymentMethod.Should().Be(PaymentMethod.Cash);
        order.AmountTendered.Should().Be(100m);
        order.ChangeDue.Should().Be(0m);
        order.CompletedAt.Should().NotBeNull();
        order.DomainEvents.Should().ContainSingle(e => e is OrderCompletedDomainEvent);
    }

    [Fact]
    public void Complete_WithOverpayment_ComputesChangeDue()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");
        order.AddLine(_variantId, "Widget", "Red", 75m, 1m);

        order.Complete(PaymentMethod.Cash, 100m);

        order.ChangeDue.Should().Be(25m);
    }

    [Fact]
    public void Complete_EmptyOrder_ReturnsEmptyOrderError()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");

        ErrorOr<Success> result = order.Complete(PaymentMethod.Cash, 0m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PosErrors.EmptyOrder);
    }

    [Fact]
    public void Complete_InsufficientPayment_ReturnsError()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");
        order.AddLine(_variantId, "Widget", "Red", 100m, 1m);

        ErrorOr<Success> result = order.Complete(PaymentMethod.Cash, 50m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PosErrors.InsufficientPayment);
        order.Status.Should().Be(OrderStatus.Open);
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    [Fact]
    public void Cancel_OpenOrder_CancelsAndRaisesEvent()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");
        order.ClearDomainEvents();

        ErrorOr<Success> result = order.Cancel("Customer request");

        result.IsError.Should().BeFalse();
        order.Status.Should().Be(OrderStatus.Cancelled);
        order.Notes.Should().Be("Customer request");
        order.DomainEvents.Should().ContainSingle(e => e is OrderCancelledDomainEvent);
    }

    [Fact]
    public void Cancel_AlreadyCompletedOrder_ReturnsOrderNotOpenError()
    {
        Order order = CreateCompletedOrder();

        ErrorOr<Success> result = order.Cancel();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PosErrors.OrderNotOpen);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Order CreateCompletedOrder()
    {
        Order order = Order.Create(_tenantId, _branchId, "USD");
        order.AddLine(_variantId, "Widget", "Red", 10m, 1m);
        order.Complete(PaymentMethod.Cash, 10m);
        return order;
    }
}
