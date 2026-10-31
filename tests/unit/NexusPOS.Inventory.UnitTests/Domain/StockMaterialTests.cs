using FluentAssertions;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;

namespace NexusPOS.Inventory.UnitTests.Domain;

public sealed class StockMaterialTests
{
    private static StockMaterial Coffee(CostMethod method, decimal cost = 0m, decimal quantity = 0m) =>
        StockMaterial.Create(Guid.NewGuid(), "cof-001", "بن قهوة", "Coffee", null,
            "كيس", "جرام", 1000m, method, cost, quantity);

    [Fact]
    public void Receive_LastPurchase_UsesLatestPrice()
    {
        StockMaterial m = Coffee(CostMethod.LastPurchase, cost: 40m, quantity: 2m);

        m.Receive(3m, 50m);

        m.CurrentQuantityInStorageUnits.Should().Be(5m);
        m.CurrentCost.Should().Be(50m);
    }

    [Fact]
    public void Receive_WeightedAverage_BlendsByQuantity()
    {
        StockMaterial m = Coffee(CostMethod.WeightedAverage, cost: 40m, quantity: 2m);

        m.Receive(3m, 50m);

        // (2*40 + 3*50) / 5 = 46
        m.CurrentQuantityInStorageUnits.Should().Be(5m);
        m.CurrentCost.Should().Be(46m);
    }

    [Fact]
    public void Receive_WeightedAverage_WithEmptyStock_TakesPurchasePrice()
    {
        StockMaterial m = Coffee(CostMethod.WeightedAverage, cost: 40m, quantity: 0m);

        m.Receive(4m, 55m);

        m.CurrentCost.Should().Be(55m);
        m.CurrentQuantityInStorageUnits.Should().Be(4m);
    }

    [Fact]
    public void CostPerComponentUnit_DividesByConversionFactor()
    {
        StockMaterial m = Coffee(CostMethod.LastPurchase);
        m.Receive(1m, 60m);

        m.CostPerComponentUnit.Should().Be(0.06m);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(-1, 10)]
    [InlineData(1, -5)]
    public void Receive_RejectsInvalidInput(decimal quantity, decimal unitCost)
    {
        StockMaterial m = Coffee(CostMethod.LastPurchase);

        Action act = () => m.Receive(quantity, unitCost);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void Receive_AfterOversell_SettlesNegativeBalance()
    {
        StockMaterial m = Coffee(CostMethod.LastPurchase, cost: 40m, quantity: 1m);
        m.Consume(6000m); // 6 bags sold against 1 on hand

        m.Receive(10m, 45m);

        m.CurrentQuantityInStorageUnits.Should().Be(5m);
        m.CurrentCost.Should().Be(45m);
    }

    [Fact]
    public void Receive_WeightedAverage_WithNegativeBalance_TakesPurchasePrice()
    {
        StockMaterial m = Coffee(CostMethod.WeightedAverage, cost: 40m, quantity: 0m);
        m.Consume(5000m);

        m.Receive(10m, 50m);

        m.CurrentQuantityInStorageUnits.Should().Be(5m);
        m.CurrentCost.Should().Be(50m);
    }

    [Fact]
    public void AdjustTo_SetsCountedQuantityAndReturnsChange()
    {
        StockMaterial m = Coffee(CostMethod.WeightedAverage, cost: 40m, quantity: 8m);

        decimal change = m.AdjustTo(5.5m);

        change.Should().Be(-2.5m);
        m.CurrentQuantityInStorageUnits.Should().Be(5.5m);
        m.CurrentCost.Should().Be(40m);
    }

    [Fact]
    public void AdjustTo_FromNegativeBalance_ReturnsPositiveChange()
    {
        StockMaterial m = Coffee(CostMethod.LastPurchase, quantity: 0m);
        m.Consume(2000m);

        decimal change = m.AdjustTo(3m);

        change.Should().Be(5m);
        m.CurrentQuantityInStorageUnits.Should().Be(3m);
    }

    [Fact]
    public void AdjustTo_RejectsNegativeCount()
    {
        StockMaterial m = Coffee(CostMethod.LastPurchase, quantity: 2m);

        Action act = () => m.AdjustTo(-1m);

        act.Should().Throw<ArgumentOutOfRangeException>();
        m.CurrentQuantityInStorageUnits.Should().Be(2m);
    }

    [Fact]
    public void Update_WithoutManualValues_KeepsLiveQuantityAndCost()
    {
        StockMaterial m = Coffee(CostMethod.WeightedAverage, cost: 40m, quantity: 2m);
        m.Receive(3m, 50m);
        m.Consume(1500m);

        m.Update("cof-001", "بن مختص", "Coffee", null, "كيس", "جرام", 1000m,
            CostMethod.WeightedAverage, null, null, null, 2m);

        m.NameAr.Should().Be("بن مختص");
        m.ReorderLevel.Should().Be(2m);
        m.CurrentQuantityInStorageUnits.Should().Be(3.5m);
        m.CurrentCost.Should().Be(46m);
    }

    [Fact]
    public void Deactivate_ThenActivate_TogglesArchive()
    {
        StockMaterial m = Coffee(CostMethod.LastPurchase);

        m.Deactivate();
        m.IsActive.Should().BeFalse();

        m.Activate();
        m.IsActive.Should().BeTrue();
    }

    [Fact]
    public void Movement_RecordsStateAfterReceive()
    {
        StockMaterial m = Coffee(CostMethod.WeightedAverage, cost: 40m, quantity: 2m);
        m.Receive(3m, 50m);

        StockMaterialMovement mv = StockMaterialMovement.Record(
            m, StockMaterialMovementType.Receive, 3m, 50m, "  فاتورة 12 ", null);

        mv.MaterialId.Should().Be(m.Id);
        mv.TenantId.Should().Be(m.TenantId);
        mv.QuantityAfter.Should().Be(5m);
        mv.CostAfter.Should().Be(46m);
        mv.Note.Should().Be("فاتورة 12");
    }
}
