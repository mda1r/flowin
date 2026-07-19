using FluentAssertions;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.SharedKernel.UnitTests.Domain;

public sealed class AggregateRootTests
{
    private sealed record OrderCreatedDomainEvent(Guid OrderId) : IDomainEvent
    {
        public Guid EventId { get; } = Guid.NewGuid();
        public DateTime OccurredAt { get; } = DateTime.UtcNow;
    }

    private sealed class Order : AggregateRoot<Guid>
    {
        public Order(Guid id) : base(id) { }

        public void Create() => RaiseDomainEvent(new OrderCreatedDomainEvent(Id));
    }

    [Fact]
    public void RaiseDomainEvent_AddsEventToCollection()
    {
        Order order = new(Guid.NewGuid());

        order.Create();

        order.DomainEvents.Should().HaveCount(1);
        order.DomainEvents[0].Should().BeOfType<OrderCreatedDomainEvent>();
    }

    [Fact]
    public void ClearDomainEvents_RemovesAllEvents()
    {
        Order order = new(Guid.NewGuid());
        order.Create();
        order.Create();

        order.ClearDomainEvents();

        order.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void DomainEvents_IsReadOnly()
    {
        Order order = new(Guid.NewGuid());

        order.DomainEvents.Should().BeAssignableTo<IReadOnlyList<IDomainEvent>>();
    }
}
