using ErrorOr;
using FluentAssertions;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;

namespace NexusPOS.Inventory.UnitTests.Domain;

public sealed class StockItemTests
{
    private static readonly Guid _variantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithDefaultThresholds_StartsAtZeroQuantity()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);

        stock.Quantity.Should().Be(0);
        stock.VariantId.Should().Be(_variantId);
        stock.BranchId.Should().Be(_branchId);
        stock.ReorderPoint.Should().Be(0);
        stock.ReorderQuantity.Should().Be(0);
        stock.Movements.Should().BeEmpty();
    }

    [Fact]
    public void Create_WithThresholds_SetsThresholds()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId, reorderPoint: 10, reorderQuantity: 50);

        stock.ReorderPoint.Should().Be(10);
        stock.ReorderQuantity.Should().Be(50);
    }

    // ── Receive ───────────────────────────────────────────────────────────────

    [Fact]
    public void Receive_ValidQuantity_IncreasesQuantityAndRecordsMovement()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);

        ErrorOr<Success> result = stock.Receive(100);

        result.IsError.Should().BeFalse();
        stock.Quantity.Should().Be(100);
        stock.Movements.Should().ContainSingle(m => m.Type == MovementType.Receive && m.Quantity == 100);
    }

    [Fact]
    public void Receive_AdditionalQuantity_AccumulatesCorrectly()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);
        stock.Receive(50);

        ErrorOr<Success> result = stock.Receive(30);

        result.IsError.Should().BeFalse();
        stock.Quantity.Should().Be(80);
        stock.Movements.Should().HaveCount(2);
    }

    [Fact]
    public void Receive_ZeroQuantity_ReturnsInvalidQuantityError()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);

        ErrorOr<Success> result = stock.Receive(0);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(InventoryErrors.InvalidQuantity);
        stock.Quantity.Should().Be(0);
    }

    [Fact]
    public void Receive_NegativeQuantity_ReturnsInvalidQuantityError()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);

        ErrorOr<Success> result = stock.Receive(-5);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(InventoryErrors.InvalidQuantity);
    }

    [Fact]
    public void Receive_RaisesStockLevelChangedEvent()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);

        stock.Receive(100);

        stock.DomainEvents.Should().ContainSingle(e =>
            e.GetType().Name == "StockLevelChangedDomainEvent");
    }

    // ── Deduct ────────────────────────────────────────────────────────────────

    [Fact]
    public void Deduct_ValidQuantity_DecreasesQuantityAndRecordsMovement()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);
        stock.Receive(100);
        stock.ClearDomainEvents();

        ErrorOr<Success> result = stock.Deduct(40, MovementType.Sale);

        result.IsError.Should().BeFalse();
        stock.Quantity.Should().Be(60);
        stock.Movements.Should().Contain(m => m.Type == MovementType.Sale && m.Quantity == 40);
    }

    [Fact]
    public void Deduct_ExactAvailableQuantity_ReducesToZero()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);
        stock.Receive(50);
        stock.ClearDomainEvents();

        ErrorOr<Success> result = stock.Deduct(50, MovementType.Sale);

        result.IsError.Should().BeFalse();
        stock.Quantity.Should().Be(0);
    }

    [Fact]
    public void Deduct_MoreThanAvailable_ReturnsInsufficientStockError()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);
        stock.Receive(30);

        ErrorOr<Success> result = stock.Deduct(50, MovementType.Sale);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(InventoryErrors.InsufficientStock);
        stock.Quantity.Should().Be(30);
    }

    [Fact]
    public void Deduct_ZeroQuantity_ReturnsInvalidQuantityError()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);
        stock.Receive(100);

        ErrorOr<Success> result = stock.Deduct(0, MovementType.Sale);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(InventoryErrors.InvalidQuantity);
    }

    [Fact]
    public void Deduct_FallsBelowReorderPoint_RaisesLowStockAlertEvent()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId, reorderPoint: 20);
        stock.Receive(100);
        stock.ClearDomainEvents();

        stock.Deduct(85, MovementType.Sale);

        stock.DomainEvents.Should().Contain(e =>
            e.GetType().Name == "LowStockAlertDomainEvent");
    }

    [Fact]
    public void Deduct_StaysAboveReorderPoint_DoesNotRaiseLowStockAlert()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId, reorderPoint: 10);
        stock.Receive(100);
        stock.ClearDomainEvents();

        stock.Deduct(50, MovementType.Sale);

        stock.DomainEvents.Should().NotContain(e =>
            e.GetType().Name == "LowStockAlertDomainEvent");
    }

    // ── Adjust ────────────────────────────────────────────────────────────────

    [Fact]
    public void Adjust_ToNewQuantity_SetsQuantityAndRecordsAdjustment()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);
        stock.Receive(50);
        stock.ClearDomainEvents();

        ErrorOr<Success> result = stock.Adjust(45);

        result.IsError.Should().BeFalse();
        stock.Quantity.Should().Be(45);
        stock.Movements.Should().Contain(m => m.Type == MovementType.Adjustment);
    }

    [Fact]
    public void Adjust_ToZero_IsAllowed()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);
        stock.Receive(100);

        ErrorOr<Success> result = stock.Adjust(0);

        result.IsError.Should().BeFalse();
        stock.Quantity.Should().Be(0);
    }

    [Fact]
    public void Adjust_NegativeValue_ReturnsInvalidQuantityError()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);
        stock.Receive(50);

        ErrorOr<Success> result = stock.Adjust(-1);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(InventoryErrors.InvalidQuantity);
        stock.Quantity.Should().Be(50);
    }

    // ── SetReorderThresholds ──────────────────────────────────────────────────

    [Fact]
    public void SetReorderThresholds_ValidValues_UpdatesThresholds()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);

        stock.SetReorderThresholds(25, 100);

        stock.ReorderPoint.Should().Be(25);
        stock.ReorderQuantity.Should().Be(100);
    }

    [Fact]
    public void SetReorderThresholds_NegativeValues_ClampedToZero()
    {
        StockItem stock = StockItem.Create(_variantId, _branchId);

        stock.SetReorderThresholds(-5, -10);

        stock.ReorderPoint.Should().Be(0);
        stock.ReorderQuantity.Should().Be(0);
    }
}
