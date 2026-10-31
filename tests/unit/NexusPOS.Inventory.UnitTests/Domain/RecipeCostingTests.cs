using FluentAssertions;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Services;

namespace NexusPOS.Inventory.UnitTests.Domain;

// The recipe screens and the till price a cup with this one formula.
public sealed class RecipeCostingTests
{
    [Fact]
    public void LineCost_DividesTheStorageUnitCostByTheConversionFactor()
    {
        // A 1 kg bag of beans at 80 holds 1000 g, so an 18 g shot costs 1.44.
        RecipeCosting.LineCost(18m, 80m, 1000m).Should().Be(1.44m);
    }

    [Fact]
    public void LineCost_IsZeroWithoutAConversionFactor()
    {
        RecipeCosting.LineCost(18m, 80m, 0m).Should().Be(0m);
    }

    [Fact]
    public void LineCost_RoundsToFourPlaces()
    {
        // 7 g of a 33.33 bag of 1000 g: 0.23331.
        RecipeCosting.LineCost(7m, 33.33m, 1000m).Should().Be(0.2333m);
    }

    [Fact]
    public void Total_AddsTheLinesOfALatte()
    {
        StockMaterial beans = StockMaterial.Create(Guid.NewGuid(), "cof-001", "بن قهوة", "Coffee", null,
            "كيس", "جرام", 1000m, CostMethod.LastPurchase, 80m);
        StockMaterial milk = StockMaterial.Create(Guid.NewGuid(), "mlk-001", "حليب", "Milk", null,
            "علبة", "مل", 2000m, CostMethod.LastPurchase, 12m);

        decimal total = RecipeCosting.Total(
        [
            RecipeCosting.LineCost(18m, beans.CurrentCost, beans.ConversionFactor),
            RecipeCosting.LineCost(200m, milk.CurrentCost, milk.ConversionFactor),
        ]);

        total.Should().Be(1.44m + 1.2m);
    }
}
