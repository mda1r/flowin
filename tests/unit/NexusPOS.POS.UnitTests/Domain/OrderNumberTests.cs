using ErrorOr;
using FluentAssertions;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class OrderNumberTests
{
    private static Order OpenOrder()
    {
        Order order = Order.Create(Guid.NewGuid(), Guid.NewGuid(), "SAR", taxRate: 0.15m);
        order.AddLine(Guid.NewGuid(), "لاتيه", "", 20m, 0m, 1m);
        return order;
    }

    [Fact]
    public void Number_TravelsWithTheCompletedSale()
    {
        Order order = OpenOrder();
        order.AssignNumber(1024);

        order.Complete(PaymentMethod.Cash, 100m).IsError.Should().BeFalse();

        order.Number.Should().Be(1024);
        order.DomainEvents.OfType<OrderCompletedDomainEvent>().Single().Number.Should().Be(1024);
    }

    [Fact]
    public void Number_NeverChangesOnceGiven()
    {
        Order order = OpenOrder();
        order.AssignNumber(7);
        order.AssignNumber(8);
        order.Complete(PaymentMethod.Cash, 100m);
        order.AssignNumber(9);

        order.Number.Should().Be(7);
    }

    [Fact]
    public void Checkout_NumbersTheSale()
    {
        CheckoutOrderCommand cmd = new(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, null,
            [new(Guid.NewGuid(), "لاتيه", "", 20m, 4m, 1m)], 0, PaymentMethod.Card, 23m, null, null, null);

        ErrorOr<Order> result = CheckoutBuilder.Build(cmd, LoyaltyRules.Default, 55);

        result.Value.Number.Should().Be(55);
        result.Value.DomainEvents.OfType<OrderCompletedDomainEvent>().Single().Number.Should().Be(55);
    }
}
