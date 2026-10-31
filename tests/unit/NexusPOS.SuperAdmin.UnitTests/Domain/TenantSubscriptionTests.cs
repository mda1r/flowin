using FluentAssertions;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Enums;

namespace NexusPOS.SuperAdmin.UnitTests.Domain;

public sealed class TenantSubscriptionTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly DateTime _now = new(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);

    private static TenantSubscription Sub(DateTime start, DateTime expiry) =>
        TenantSubscription.Create(_tenantId, Guid.NewGuid(), start, expiry, maxBranches: 1, maxUsers: 5);

    [Fact]
    public void EffectiveStatus_WithinDates_IsActive()
    {
        TenantSubscription sub = Sub(_now.AddDays(-10), _now.AddDays(20));

        sub.EffectiveStatus(_now).Should().Be(SubscriptionStatus.Active);
        sub.IsLiveAt(_now).Should().BeTrue();
    }

    [Fact]
    public void EffectiveStatus_PastExpiry_IsExpiredEvenIfStoredActive()
    {
        TenantSubscription sub = Sub(_now.AddDays(-40), _now.AddDays(-1));

        sub.EffectiveStatus(_now).Should().Be(SubscriptionStatus.Expired);
        sub.IsLiveAt(_now).Should().BeFalse();
    }

    [Fact]
    public void EffectiveStatus_FutureStart_IsUpcomingThenActive()
    {
        TenantSubscription sub = Sub(_now.AddDays(5), _now.AddDays(35));

        sub.EffectiveStatus(_now).Should().Be(SubscriptionStatus.Trial);
        sub.IsLiveAt(_now.AddDays(6)).Should().BeTrue();
    }

    [Fact]
    public void EffectiveStatus_Suspended_StaysSuspended()
    {
        TenantSubscription sub = Sub(_now.AddDays(-1), _now.AddDays(30));

        sub.Suspend();

        sub.EffectiveStatus(_now).Should().Be(SubscriptionStatus.Suspended);
        sub.IsLiveAt(_now).Should().BeFalse();
    }

    [Fact]
    public void Extend_RunningSubscription_AddsMonthsToExpiry()
    {
        DateTime expiry = _now.AddDays(3);
        TenantSubscription sub = Sub(_now.AddDays(-27), expiry);

        sub.Extend(3, _now);

        sub.ExpiryDate.Should().Be(expiry.AddMonths(3));
    }

    [Fact]
    public void Extend_ElapsedSubscription_CountsFromToday()
    {
        TenantSubscription sub = Sub(_now.AddDays(-60), _now.AddDays(-30));

        sub.Extend(1, _now);

        sub.ExpiryDate.Should().Be(_now.AddMonths(1));
        sub.IsLiveAt(_now).Should().BeTrue();
    }

    [Fact]
    public void Extend_ZeroMonths_Throws()
    {
        TenantSubscription sub = Sub(_now, _now.AddDays(30));

        Action act = () => sub.Extend(0, _now);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void EndAt_MidTerm_ShortensExpiry()
    {
        TenantSubscription sub = Sub(_now.AddDays(-10), _now.AddDays(20));

        sub.EndAt(_now);

        sub.ExpiryDate.Should().Be(_now);
        sub.Status.Should().NotBe(SubscriptionStatus.Cancelled);
    }

    [Fact]
    public void EndAt_BeforeStart_Cancels()
    {
        TenantSubscription sub = Sub(_now.AddDays(10), _now.AddDays(40));

        sub.EndAt(_now);

        sub.Status.Should().Be(SubscriptionStatus.Cancelled);
        sub.EffectiveStatus(_now.AddDays(15)).Should().Be(SubscriptionStatus.Cancelled);
    }

    [Fact]
    public void PickCurrent_PrefersLiveOverUpcomingAndExpired()
    {
        TenantSubscription expired = Sub(_now.AddDays(-90), _now.AddDays(-30));
        TenantSubscription live = Sub(_now.AddDays(-5), _now.AddDays(25));
        TenantSubscription upcoming = Sub(_now.AddDays(25), _now.AddDays(55));

        TenantSubscription.PickCurrent([expired, upcoming, live], _now).Should().BeSameAs(live);
    }

    [Fact]
    public void PickCurrent_OnlyUpcoming_ReturnsEarliestUpcoming()
    {
        TenantSubscription later = Sub(_now.AddDays(40), _now.AddDays(70));
        TenantSubscription sooner = Sub(_now.AddDays(10), _now.AddDays(40));

        TenantSubscription.PickCurrent([later, sooner], _now).Should().BeSameAs(sooner);
    }

    [Fact]
    public void PickCurrent_OnlyElapsed_ReturnsMostRecent()
    {
        TenantSubscription older = Sub(_now.AddDays(-90), _now.AddDays(-60));
        TenantSubscription recent = Sub(_now.AddDays(-40), _now.AddDays(-10));

        TenantSubscription picked = TenantSubscription.PickCurrent([older, recent], _now)!;

        picked.Should().BeSameAs(recent);
        picked.EffectiveStatus(_now).Should().Be(SubscriptionStatus.Expired);
    }

    [Fact]
    public void PickCurrent_IgnoresCancelled()
    {
        TenantSubscription cancelled = Sub(_now.AddDays(10), _now.AddDays(40));
        cancelled.EndAt(_now);

        TenantSubscription.PickCurrent([cancelled], _now).Should().BeNull();
    }

    [Fact]
    public void PickRenewable_WithPrepaidPeriod_ReturnsEndOfChainNotLive()
    {
        TenantSubscription live = Sub(_now.AddDays(-20), _now.AddDays(10));
        TenantSubscription prepaid = Sub(_now.AddDays(10), _now.AddDays(40));

        TenantSubscription.PickCurrent([live, prepaid], _now).Should().BeSameAs(live);
        TenantSubscription.PickRenewable([live, prepaid]).Should().BeSameAs(prepaid);
    }

    [Fact]
    public void PickRenewable_IgnoresCancelled()
    {
        TenantSubscription live = Sub(_now.AddDays(-20), _now.AddDays(10));
        TenantSubscription cancelled = Sub(_now.AddDays(10), _now.AddDays(40));
        cancelled.EndAt(_now);

        TenantSubscription.PickRenewable([live, cancelled]).Should().BeSameAs(live);
    }
}
