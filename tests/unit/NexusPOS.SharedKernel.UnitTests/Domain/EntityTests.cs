using FluentAssertions;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.SharedKernel.UnitTests.Domain;

public sealed class EntityTests
{
    private sealed class OrderId
    {
        public Guid Value { get; }
        public OrderId(Guid value) { Value = value; }

        public override bool Equals(object? obj) => obj is OrderId other && Value == other.Value;
        public override int GetHashCode() => Value.GetHashCode();
    }

    private sealed class Order : Entity<OrderId>
    {
        public Order(OrderId id) : base(id) { }
    }

    private sealed class Invoice : Entity<OrderId>
    {
        public Invoice(OrderId id) : base(id) { }
    }

    [Fact]
    public void Equals_SameTypeAndId_ReturnsTrue()
    {
        OrderId id = new(Guid.NewGuid());
        Order a = new(id);
        Order b = new(id);

        a.Equals(b).Should().BeTrue();
        (a == b).Should().BeTrue();
    }

    [Fact]
    public void Equals_SameReference_ReturnsTrue()
    {
        Order a = new(new OrderId(Guid.NewGuid()));

        a.Equals(a).Should().BeTrue();
    }

    [Fact]
    public void Equals_DifferentId_ReturnsFalse()
    {
        Order a = new(new OrderId(Guid.NewGuid()));
        Order b = new(new OrderId(Guid.NewGuid()));

        a.Equals(b).Should().BeFalse();
        (a != b).Should().BeTrue();
    }

    [Fact]
    public void Equals_DifferentType_ReturnsFalse()
    {
        OrderId id = new(Guid.NewGuid());
        Order order = new(id);
        Invoice invoice = new(id);

        order.Equals(invoice).Should().BeFalse();
    }

    [Fact]
    public void Equals_Null_ReturnsFalse()
    {
        Order a = new(new OrderId(Guid.NewGuid()));

        a.Equals(null).Should().BeFalse();
    }

    [Fact]
    public void GetHashCode_SameId_ReturnsSameHash()
    {
        OrderId id = new(Guid.NewGuid());
        Order a = new(id);
        Order b = new(id);

        a.GetHashCode().Should().Be(b.GetHashCode());
    }
}
