using ErrorOr;
using FluentAssertions;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class CheckoutBuilderTests
{
    private static readonly Guid _latte = Guid.NewGuid();
    private static readonly Guid _cookie = Guid.NewGuid();

    private static CheckoutOrderCommand Command(
        PaymentMethod method = PaymentMethod.Cash, decimal tendered = 100m, int points = 0, Guid? customer = null,
        decimal? cash = null, decimal? card = null, DateTime? offlineAt = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, customer,
            [new(_latte, "لاتيه", "كبير", 20m, 4m, 2m), new(_cookie, "كوكيز", "", 10m, 2m, 1m)],
            points, method, tendered, cash, card, offlineAt);

    [Fact]
    public void BuildsACompletedOrderWithTheTillReference()
    {
        CheckoutOrderCommand cmd = Command(offlineAt: new DateTime(2026, 10, 25, 9, 0, 0, DateTimeKind.Utc));

        ErrorOr<Order> result = CheckoutBuilder.Build(cmd, LoyaltyRules.Default);

        result.IsError.Should().BeFalse();
        Order order = result.Value;
        order.Status.Should().Be(OrderStatus.Completed);
        order.ClientReference.Should().Be(cmd.ClientReference);
        order.OfflineCreatedAt.Should().Be(cmd.OfflineCreatedAt);
        order.SubtotalAmount.Should().Be(50m);
        order.TotalAmount.Should().Be(57.50m);
        order.Lines.Should().HaveCount(2);
    }

    [Fact]
    public void SplitPayment_KeepsBothPortions()
    {
        ErrorOr<Order> result = CheckoutBuilder.Build(Command(PaymentMethod.Split, 57.50m, cash: 20m, card: 37.50m), LoyaltyRules.Default);

        result.Value.SplitCash.Should().Be(20m);
        result.Value.SplitCard.Should().Be(37.50m);
    }

    [Fact]
    public void LoyaltyRedemption_IsAppliedBeforePayment()
    {
        ErrorOr<Order> result = CheckoutBuilder.Build(Command(tendered: 52.50m, points: 100, customer: Guid.NewGuid()), LoyaltyRules.Default);

        result.Value.LoyaltyPointsRedeemed.Should().Be(100);
        Math.Round(result.Value.TotalAmount, 2).Should().Be(52.50m);
    }

    [Fact]
    public void LoyaltyWithoutCustomer_FailsAndNothingIsBuilt()
    {
        CheckoutBuilder.Build(Command(points: 100), LoyaltyRules.Default).FirstError.Should().Be(PosErrors.LoyaltyRequiresCustomer);
    }

    [Fact]
    public void ATenderRoundedToTheHalala_IsAccepted()
    {
        // 57.4999 from the till must not be rejected as short of a 57.50 total.
        CheckoutBuilder.Build(Command(PaymentMethod.Card, 57.4999m), LoyaltyRules.Default).IsError.Should().BeFalse();
    }
}
