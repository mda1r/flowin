using ErrorOr;
using FluentAssertions;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.UnitTests.Domain;

public sealed class RestaurantOrderPaymentTests
{
    private static readonly Guid _burger = Guid.NewGuid();
    private static readonly Guid _juice = Guid.NewGuid();
    private static readonly HashSet<Guid> _menu = [_burger, _juice];

    private static RestaurantOrder NewOrder()
    {
        ErrorOr<RestaurantOrder> result = RestaurantOrder.Create(
            Guid.NewGuid(), Guid.NewGuid(), 4,
            [(_burger, "برجر", 2, 30m, null), (_juice, "عصير", 1, 12m, null)],
            null, null, 0m);
        RestaurantOrder order = result.Value;
        order.ClearDomainEvents();
        return order;
    }

    [Fact]
    public void Pay_RaisesRecipeItemsSoldWithEveryMenuItemAndQuantity()
    {
        RestaurantOrder order = NewOrder();

        order.Pay("Cash", 1000m, _menu).IsError.Should().BeFalse();

        RecipeItemsSoldDomainEvent sold = order.DomainEvents.OfType<RecipeItemsSoldDomainEvent>().Single();
        sold.TenantId.Should().Be(order.TenantId);
        sold.SaleId.Should().Be(order.Id.Value);
        sold.Lines.Should().BeEquivalentTo(
        [
            new RecipeItemsSoldDomainEvent.Line(_burger, 2m),
            new RecipeItemsSoldDomainEvent.Line(_juice, 1m),
        ]);
    }

    [Fact]
    public void Pay_WhenRejected_RaisesNothing()
    {
        RestaurantOrder order = NewOrder();

        order.Pay("Cash", 1m, _menu).IsError.Should().BeTrue();

        order.DomainEvents.OfType<RecipeItemsSoldDomainEvent>().Should().BeEmpty();
    }

    [Fact]
    public void Pay_Twice_DeductsOnlyOnce()
    {
        RestaurantOrder order = NewOrder();
        order.Pay("Cash", 1000m, _menu);

        order.Pay("Cash", 1000m, _menu).IsError.Should().BeTrue();

        order.DomainEvents.OfType<RecipeItemsSoldDomainEvent>().Should().ContainSingle();
    }

    [Fact]
    public void Pay_IgnoresItemsThatAreNotRealMenuItems()
    {
        RestaurantOrder order = NewOrder();

        order.Pay("Cash", 1000m, new HashSet<Guid> { _juice });

        order.DomainEvents.OfType<RecipeItemsSoldDomainEvent>().Single().Lines
            .Should().ContainSingle().Which.ItemId.Should().Be(_juice);
    }

    [Fact]
    public void Pay_MirroredCafeOrder_RaisesNoRecipeSale()
    {
        RestaurantOrder order = NewOrder();

        order.Pay("Cash", 1000m, new HashSet<Guid>()).IsError.Should().BeFalse();

        order.DomainEvents.OfType<RecipeItemsSoldDomainEvent>().Should().BeEmpty();
    }
}
