using FluentAssertions;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Services;

namespace NexusPOS.Inventory.UnitTests.Domain;

public sealed class RecipeTests
{
    private static readonly Guid _tenant = Guid.NewGuid();
    private static readonly Guid _latte = Guid.NewGuid();
    private static readonly Guid _espresso = Guid.NewGuid();
    private static readonly Guid _coffee = Guid.NewGuid();
    private static readonly Guid _milk = Guid.NewGuid();

    private static readonly RecipeLine[] _recipes =
    [
        RecipeLine.Create(_tenant, _latte, _coffee, 18m),
        RecipeLine.Create(_tenant, _latte, _milk, 200m),
        RecipeLine.Create(_tenant, _espresso, _coffee, 9m),
    ];

    [Fact]
    public void ComponentQuantities_SumsAcrossLinesAndProducts()
    {
        Dictionary<Guid, decimal> used = RecipeConsumption.ComponentQuantities(
            _recipes, [(_latte, 2m), (_espresso, 3m)]);

        used[_coffee].Should().Be(18m * 2 + 9m * 3);
        used[_milk].Should().Be(400m);
    }

    [Fact]
    public void ComponentQuantities_IgnoresProductsWithoutRecipeAndNonPositiveQuantities()
    {
        Dictionary<Guid, decimal> used = RecipeConsumption.ComponentQuantities(
            _recipes, [(Guid.NewGuid(), 5m), (_latte, 0m), (_latte, -1m)]);

        used.Should().BeEmpty();
    }

    [Fact]
    public void Consume_ConvertsComponentUnitsToStorageUnits()
    {
        StockMaterial coffee = StockMaterial.Create(_tenant, "COF", "بن", null, null, "كيس", "جرام", 1000m,
            CostMethod.LastPurchase, 60m, 2m);

        coffee.Consume(500m);

        coffee.CurrentQuantityInStorageUnits.Should().Be(1.5m);
    }

    [Fact]
    public void Consume_CanGoNegativeSoSalesAreNeverLost()
    {
        StockMaterial milk = StockMaterial.Create(_tenant, "MLK", "حليب", null, null, "علبة", "مل", 1000m,
            CostMethod.LastPurchase, 8m, 0.1m);

        milk.Consume(400m);

        milk.CurrentQuantityInStorageUnits.Should().Be(-0.3m);
        milk.IsLowStock.Should().BeFalse("no reorder level is set");
    }

    [Fact]
    public void RecipeLine_RejectsNonPositiveQuantity()
    {
        Action act = () => RecipeLine.Create(_tenant, _latte, _milk, 0m);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
