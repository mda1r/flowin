using ErrorOr;
using FluentAssertions;
using NexusPOS.Restaurant.Domain.Entities;

namespace NexusPOS.Restaurant.UnitTests.Domain;

public sealed class RestaurantOrderTotalsTests
{
    private static RestaurantOrder Order(decimal discount)
    {
        ErrorOr<RestaurantOrder> result = RestaurantOrder.Create(
            Guid.NewGuid(), Guid.NewGuid(), 3,
            [(Guid.NewGuid(), "برجر", 2, 30m, null), (Guid.NewGuid(), "عصير", 1, 12m, null)],
            null, null, discount);
        return result.Value;
    }

    [Fact]
    public void MenuPricesIncludeVat_CustomerPaysTheListedPrice()
    {
        RestaurantOrder order = Order(0m);

        order.SubTotal.Should().Be(72m);
        order.Total.Should().Be(72m);
        Math.Round(order.TaxAmount, 2).Should().Be(9.39m);
    }

    [Fact]
    public void Discount_ComesOffTheListedPriceAndVatIsItsShare()
    {
        RestaurantOrder order = Order(12m);

        order.Total.Should().Be(60m);
        Math.Round(order.TaxAmount, 2).Should().Be(7.83m);
    }
}
