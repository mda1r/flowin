using FluentAssertions;
using NexusPOS.CRM.Application.Services;

namespace NexusPOS.CRM.UnitTests.Application;

public sealed class LoyaltyReversalTests
{
    // ── Earned points ─────────────────────────────────────────────────────────

    [Fact]
    public void FullReturn_TakesBackAllEarnedPoints()
    {
        LoyaltyReversal.Result r = LoyaltyReversal.Compute(
            pointsEarned: 115, pointsRedeemed: 0, orderTotal: 115m, pointsValue: 0m,
            returnedShare: 1m, refundedToDate: 115m, alreadyTakenBack: 0, alreadyGivenBack: 0);

        r.TakeBack.Should().Be(115);
        r.GiveBack.Should().Be(0);
    }

    [Fact]
    public void PartialReturn_TakesBackItsShare()
    {
        LoyaltyReversal.Result r = LoyaltyReversal.Compute(
            pointsEarned: 100, pointsRedeemed: 0, orderTotal: 100m, pointsValue: 0m,
            returnedShare: 0.25m, refundedToDate: 25m, alreadyTakenBack: 0, alreadyGivenBack: 0);

        r.TakeBack.Should().Be(25);
    }

    [Fact]
    public void SeveralPartialReturns_AddUpToTheFullAmount()
    {
        // Three returns of a third each: 33.33 rounds to 33, then 67 - 33, then 100 - 67.
        int taken = 0;
        foreach (decimal share in new[] { 1m / 3m, 2m / 3m, 1m })
        {
            LoyaltyReversal.Result r = LoyaltyReversal.Compute(
                pointsEarned: 100, pointsRedeemed: 0, orderTotal: 100m, pointsValue: 0m,
                returnedShare: share, refundedToDate: share * 100m, alreadyTakenBack: taken, alreadyGivenBack: 0);
            taken += r.TakeBack;
        }

        taken.Should().Be(100);
    }

    [Fact]
    public void ShareAboveOne_IsCappedAtTheEarnedPoints()
    {
        LoyaltyReversal.Result r = LoyaltyReversal.Compute(
            pointsEarned: 50, pointsRedeemed: 0, orderTotal: 50m, pointsValue: 0m,
            returnedShare: 1.4m, refundedToDate: 70m, alreadyTakenBack: 0, alreadyGivenBack: 0);

        r.TakeBack.Should().Be(50);
    }

    [Fact]
    public void AlreadyReversed_TakesNothingMore()
    {
        LoyaltyReversal.Result r = LoyaltyReversal.Compute(
            pointsEarned: 80, pointsRedeemed: 0, orderTotal: 80m, pointsValue: 0m,
            returnedShare: 1m, refundedToDate: 80m, alreadyTakenBack: 80, alreadyGivenBack: 0);

        r.TakeBack.Should().Be(0);
    }

    // ── Redeemed points ───────────────────────────────────────────────────────

    [Fact]
    public void RefundOfAmountPaid_GivesBackRedeemedPoints()
    {
        // Shelf price 115, 200 points took 10 off, 105 paid; the refund returns the 105 paid, so the points come back.
        LoyaltyReversal.Result r = LoyaltyReversal.Compute(
            pointsEarned: 105, pointsRedeemed: 200, orderTotal: 105m, pointsValue: 10m,
            returnedShare: 1m, refundedToDate: 105m, alreadyTakenBack: 0, alreadyGivenBack: 0);

        r.GiveBack.Should().Be(200);
    }

    [Fact]
    public void RefundOfShelfPrice_KeepsRedeemedPointsSpent()
    {
        // The refund paid out the full 115 in cash, which already includes the 10 the points were worth.
        LoyaltyReversal.Result r = LoyaltyReversal.Compute(
            pointsEarned: 105, pointsRedeemed: 200, orderTotal: 105m, pointsValue: 10m,
            returnedShare: 1m, refundedToDate: 115m, alreadyTakenBack: 0, alreadyGivenBack: 0);

        r.TakeBack.Should().Be(105);
        r.GiveBack.Should().Be(0);
    }

    [Fact]
    public void HalfReturnOfAmountPaid_GivesBackHalfTheRedeemedPoints()
    {
        LoyaltyReversal.Result r = LoyaltyReversal.Compute(
            pointsEarned: 105, pointsRedeemed: 200, orderTotal: 105m, pointsValue: 10m,
            returnedShare: 0.5m, refundedToDate: 52.5m, alreadyTakenBack: 0, alreadyGivenBack: 0);

        r.TakeBack.Should().Be(53);
        r.GiveBack.Should().Be(100);
    }

    [Fact]
    public void SaleFullyPaidWithPoints_GivesThemAllBack()
    {
        LoyaltyReversal.Result r = LoyaltyReversal.Compute(
            pointsEarned: 0, pointsRedeemed: 400, orderTotal: 0m, pointsValue: 20m,
            returnedShare: 1m, refundedToDate: 0m, alreadyTakenBack: 0, alreadyGivenBack: 0);

        r.TakeBack.Should().Be(0);
        r.GiveBack.Should().Be(400);
    }

    [Fact]
    public void RedeemedPointsAlreadyReturned_AreNotGivenTwice()
    {
        LoyaltyReversal.Result r = LoyaltyReversal.Compute(
            pointsEarned: 0, pointsRedeemed: 400, orderTotal: 0m, pointsValue: 20m,
            returnedShare: 1m, refundedToDate: 0m, alreadyTakenBack: 0, alreadyGivenBack: 400);

        r.GiveBack.Should().Be(0);
    }
}
