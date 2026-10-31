using FluentAssertions;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class ReturnOrderTests
{
    private static ReturnOrder NewReturn(ReturnOrderCompletedDomainEvent.CustomerLoyalty? loyalty) =>
        ReturnOrder.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "sar", RefundMethod.Cash,
            [(Guid.NewGuid(), Guid.NewGuid(), "لاتيه", "كبير", 1m, 100m, ReturnReason.CustomerRequest)],
            restockItems: true, taxRate: 0.15m, loyalty).Value;

    [Fact]
    public void Create_WithoutCustomer_RaisesEventWithoutLoyalty()
    {
        ReturnOrderCompletedDomainEvent e = NewReturn(null).DomainEvents.OfType<ReturnOrderCompletedDomainEvent>().Single();

        e.Loyalty.Should().BeNull();
        e.RefundAmount.Should().Be(115m);
    }

    [Fact]
    public void Create_WithCustomer_AddsThisRefundToWhatWasRefundedBefore()
    {
        Guid customerId = Guid.NewGuid();
        ReturnOrderCompletedDomainEvent.CustomerLoyalty loyalty = new(
            customerId, OrderTotal: 230m, PointsRedeemed: 0, PointsValue: 0m,
            ReturnedShare: 1m, RefundedToDate: 115m, OrderCompletedAt: DateTime.UtcNow);

        ReturnOrderCompletedDomainEvent e = NewReturn(loyalty).DomainEvents.OfType<ReturnOrderCompletedDomainEvent>().Single();

        e.Loyalty.Should().NotBeNull();
        e.Loyalty!.CustomerId.Should().Be(customerId);
        e.Loyalty.RefundedToDate.Should().Be(230m);
    }
}
