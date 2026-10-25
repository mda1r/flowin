using ErrorOr;
using FluentAssertions;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class LoyaltyRulesTests
{
    private static readonly Guid _tenant = Guid.NewGuid();
    private static readonly Guid _customer = Guid.NewGuid();

    // 50 points are worth 10 riyals, redeemable once the customer has 50; 2 points per riyal paid.
    private static readonly LoyaltyRules _generous = new(true, 2m, 50, 10m, 50);

    private sealed class FakeDirectory(LoyaltyRules rules, int balance) : ICustomerLoyaltyDirectory
    {
        public Task<int?> GetPointsAsync(Guid tenantId, Guid customerId, CancellationToken cancellationToken = default) =>
            Task.FromResult<int?>(balance);

        public Task<LoyaltyRules> GetRulesAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
            Task.FromResult(rules);
    }

    [Fact]
    public void StoreValue_SetsHowMuchThePointsTakeOff()
    {
        Order order = Order.Create(_tenant, Guid.NewGuid(), "SAR", _customer, taxRate: 0.15m);
        order.AddLine(Guid.NewGuid(), "لاتيه", "كبير", 100m, 0m, 1m);

        order.RedeemLoyaltyPoints(50, _generous.ValuePerPoint).IsError.Should().BeFalse();

        Math.Round(order.TotalAmount, 2).Should().Be(105m);
        order.LoyaltyPointValue.Should().Be(0.2m);
    }

    [Fact]
    public void RemovingLines_TrimsPointsAtTheValueTheyWereRedeemedAt()
    {
        Order order = Order.Create(_tenant, Guid.NewGuid(), "SAR", _customer, taxRate: 0.15m);
        order.AddLine(Guid.NewGuid(), "ماء", "صغير", 10m, 0m, 1m);
        OrderLine big = order.AddLine(Guid.NewGuid(), "لاتيه", "كبير", 100m, 0m, 1m).Value;
        order.RedeemLoyaltyPoints(200, _generous.ValuePerPoint);

        order.RemoveLine(big.Id);

        // 11.50 left at 0.20 a point fits 57 points.
        order.LoyaltyPointsRedeemed.Should().Be(57);
        order.TotalAmount.Should().BeGreaterThanOrEqualTo(0m);
    }

    [Fact]
    public void PointsEarned_FollowsTheStoreRate_AndStopsWhenSwitchedOff()
    {
        _generous.PointsEarned(25.9m).Should().Be(51);
        (_generous with { Enabled = false }).PointsEarned(25.9m).Should().Be(0);
        new LoyaltyRules(true, 0.5m, 100, 5m, 0).PointsEarned(9m).Should().Be(4);
        _generous.PointsEarned(104.9999m).Should().Be(210);
    }

    [Fact]
    public void ValuePerPoint_IsRoundedTheSameEverywhere()
    {
        new LoyaltyRules(true, 1m, 3, 1m, 0).ValuePerPoint.Should().Be(0.333333m);
        LoyaltyRules.ValueOf(3, 0.333333m).Should().Be(1.00m);
    }

    [Fact]
    public async Task Check_BelowTheStoreMinimum_IsRejected()
    {
        ErrorOr<LoyaltyRules> result = await LoyaltyRedemption.CheckAsync(
            new FakeDirectory(_generous, 500), _tenant, _customer, 40, CancellationToken.None);

        result.FirstError.Code.Should().Be(PosErrors.LoyaltyBelowMinimum(50).Code);
    }

    [Fact]
    public async Task Check_WhenTheProgrammeIsOff_IsRejected()
    {
        ErrorOr<LoyaltyRules> result = await LoyaltyRedemption.CheckAsync(
            new FakeDirectory(_generous with { Enabled = false }, 500), _tenant, _customer, 100, CancellationToken.None);

        result.FirstError.Should().Be(PosErrors.LoyaltyDisabled);
    }

    [Fact]
    public async Task Check_MoreThanTheBalance_IsRejected()
    {
        ErrorOr<LoyaltyRules> result = await LoyaltyRedemption.CheckAsync(
            new FakeDirectory(_generous, 60), _tenant, _customer, 100, CancellationToken.None);

        result.FirstError.Should().Be(PosErrors.InsufficientLoyaltyPoints);
    }

    [Fact]
    public async Task Check_NoPoints_ReturnsTheRulesEvenWhenSwitchedOff()
    {
        ErrorOr<LoyaltyRules> result = await LoyaltyRedemption.CheckAsync(
            new FakeDirectory(_generous with { Enabled = false }, 0), _tenant, _customer, 0, CancellationToken.None);

        result.IsError.Should().BeFalse();
    }
}
