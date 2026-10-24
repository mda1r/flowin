using ErrorOr;
using FluentAssertions;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.UnitTests.Domain;

public sealed class RestaurantOrderPaymentTests
{
    private static readonly Guid _burger = Guid.NewGuid();
    private static readonly Guid _juice = Guid.NewGuid();

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

        order.Pay("Cash", 1000m).IsError.Should().BeFalse();

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

        order.Pay("Cash", 1m).IsError.Should().BeTrue();

        order.DomainEvents.OfType<RecipeItemsSoldDomainEvent>().Should().BeEmpty();
    }

    [Fact]
    public void Pay_Twice_DeductsOnlyOnce()
    {
        RestaurantOrder order = NewOrder();
        order.Pay("Cash", 1000m);

        order.Pay("Cash", 1000m).IsError.Should().BeTrue();

        order.DomainEvents.OfType<RecipeItemsSoldDomainEvent>().Should().ContainSingle();
    }
}
