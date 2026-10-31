using ErrorOr;
using FluentAssertions;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class OfflineSaleTests
{
    private static CheckoutOrderCommand Command(DateTime? offlineAt) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, null,
            [new(Guid.NewGuid(), "لاتيه", "", 20m, 4m, 1m)], 0, PaymentMethod.Cash, 23m, null, null, offlineAt);

    [Fact]
    public void OfflineSale_IsDatedWhenItWasRungUp_NotWhenItSynced()
    {
        DateTime rungUp = DateTime.UtcNow.AddHours(-9);
        DateTime before = DateTime.UtcNow;

        Order order = CheckoutBuilder.Build(Command(rungUp), LoyaltyRules.Default).Value;

        order.CompletedAt.Should().Be(rungUp);
        // Received now, so it still shows in today's order lists.
        order.CreatedAt.Should().BeOnOrAfter(before);
        order.DomainEvents.OfType<OrderCompletedDomainEvent>().Single().CompletedAt.Should().Be(rungUp);
    }

    [Fact]
    public void OnlineSale_IsDatedNow()
    {
        DateTime before = DateTime.UtcNow;

        Order order = CheckoutBuilder.Build(Command(null), LoyaltyRules.Default).Value;

        order.CompletedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(DateTime.UtcNow);
        order.OfflineCreatedAt.Should().BeNull();
    }

    [Fact]
    public void ATillClockInTheFuture_IsDatedNow()
    {
        DateTime now = new(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc);

        CheckoutBuilder.SaleTime(now.AddHours(5), now).Should().BeNull();
    }

    [Fact]
    public void AStampFromMomentsAgo_IsTreatedAsAnOnlineSale()
    {
        DateTime now = new(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc);

        CheckoutBuilder.SaleTime(now.AddSeconds(-20), now).Should().BeNull();
        CheckoutBuilder.SaleTime(now.AddMinutes(-5), now).Should().Be(now.AddMinutes(-5));
    }

    [Fact]
    public void ASaleSyncedAfterItsShiftClosed_LandsInTheShiftOpenNow()
    {
        DateTime now = new(2026, 10, 31, 20, 0, 0, DateTimeKind.Utc);
        DateTime rungUpInShiftA = new(2026, 10, 31, 15, 0, 0, DateTimeKind.Utc);
        DateTime shiftBOpened = new(2026, 10, 31, 17, 0, 0, DateTimeKind.Utc);

        DateTime? at = CheckoutBuilder.SaleTime(rungUpInShiftA, now, notBefore: shiftBOpened);

        // Shift B's close counts orders with CompletedAt >= its OpenedAt, so the cash is not lost between shifts.
        at.Should().Be(shiftBOpened);
        CheckoutBuilder.SaleTime(new DateTime(2026, 10, 31, 18, 0, 0, DateTimeKind.Utc), now, shiftBOpened)
            .Should().Be(new DateTime(2026, 10, 31, 18, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void ABackdatedSale_NeverLeavesTheOpenShift()
    {
        DateTime shiftOpened = DateTime.UtcNow.AddHours(-2);

        Order order = CheckoutBuilder.Build(Command(DateTime.UtcNow.AddHours(-40)), LoyaltyRules.Default, notBefore: shiftOpened).Value;

        order.CompletedAt.Should().Be(shiftOpened);
        order.DomainEvents.OfType<OrderCompletedDomainEvent>().Single().CompletedAt.Should().Be(shiftOpened);
    }

    [Fact]
    public void AnImplausiblyOldClock_IsHeldToTheOfflineWindow()
    {
        DateTime now = new(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc);

        CheckoutBuilder.SaleTime(now.AddDays(-30), now).Should().Be(now.AddHours(-72));
        CheckoutBuilder.SaleTime(now.AddHours(-71), now).Should().Be(now.AddHours(-71));
    }

    [Fact]
    public void ATimeWithoutAZone_IsReadAsUtc()
    {
        DateTime now = new(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc);

        DateTime? at = CheckoutBuilder.SaleTime(new DateTime(2026, 10, 31, 2, 0, 0, DateTimeKind.Unspecified), now);

        at.Should().Be(new DateTime(2026, 10, 31, 2, 0, 0, DateTimeKind.Utc));
        at!.Value.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void TheResponse_LabelsTheSaleAsOffline()
    {
        DateTime rungUp = DateTime.UtcNow.AddMinutes(-30);

        OrderResponse response = OrderMapper.ToResponse(CheckoutBuilder.Build(Command(rungUp), LoyaltyRules.Default).Value);

        response.OfflineCreatedAt.Should().Be(rungUp);
        response.CompletedAt.Should().Be(rungUp);
    }

    [Fact]
    public void ASaleNumberedAfterItCompletes_PublishesTheNumber()
    {
        ErrorOr<Order> built = CheckoutBuilder.Build(Command(null), LoyaltyRules.Default);
        Order order = built.Value;
        order.Number.Should().BeNull();

        order.AssignNumber(301);

        order.Number.Should().Be(301);
        OrderCompletedDomainEvent completed = order.DomainEvents.OfType<OrderCompletedDomainEvent>().Single();
        completed.Number.Should().Be(301);
        order.DomainEvents.OfType<OrderCreatedDomainEvent>().Should().ContainSingle();
    }

    [Fact]
    public void ACancelledOrder_NeverTakesANumber()
    {
        Order order = Order.Create(Guid.NewGuid(), Guid.NewGuid(), "SAR", taxRate: 0.15m);
        order.Cancel();

        order.AssignNumber(12);

        order.Number.Should().BeNull();
    }
}
