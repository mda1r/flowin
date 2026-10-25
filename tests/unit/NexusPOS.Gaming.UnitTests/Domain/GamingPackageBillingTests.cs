using FluentAssertions;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;

namespace NexusPOS.Gaming.UnitTests.Domain;

public sealed class GamingPackageBillingTests
{
    // 3 hours for 50 SAR on a station that charges 20 SAR/hour.
    private static GameSession PackageSession(out DateTime start)
    {
        GamingPackage package = GamingPackage.Create(Guid.NewGuid(), Guid.NewGuid(), "٣ ساعات", 180, 50m, null);
        GameSession session = GameSession.CreateWithPackage(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "أحمد", package, 20m);
        start = session.StartTime;
        return session;
    }

    [Fact]
    public void EndingEarly_StillCostsThePackagePrice()
    {
        GameSession session = PackageSession(out DateTime start);

        session.Complete(start.AddMinutes(95)).Should().Be(50m);
        session.OvertimeMinutes.Should().Be(0m);
    }

    [Fact]
    public void PlayingExactlyThePackage_CostsThePackagePrice()
    {
        GameSession session = PackageSession(out DateTime start);

        session.Complete(start.AddMinutes(180)).Should().Be(50m);
    }

    [Fact]
    public void Overtime_IsBilledAtTheHourlyRate()
    {
        GameSession session = PackageSession(out DateTime start);

        // 20 extra minutes at 20 SAR/hour = 6.67
        session.Complete(start.AddMinutes(200)).Should().Be(56.67m);
        session.OvertimeMinutes.Should().Be(20m);
    }

    [Fact]
    public void Package_SnapshotIsTakenAtStart()
    {
        GameSession session = PackageSession(out _);

        session.PackageName.Should().Be("٣ ساعات");
        session.PackagePrice.Should().Be(50m);
        session.DurationMinutes.Should().Be(180);
    }

    [Fact]
    public void HourlySessions_AreUnchanged()
    {
        GameSession session = GameSession.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "سارة", 60, 20m);

        session.Complete(session.StartTime.AddMinutes(90)).Should().Be(30m);
    }

    [Theory]
    [InlineData(null, StationType.Console, true)]
    [InlineData(StationType.Console, StationType.Console, true)]
    [InlineData(StationType.PC, StationType.Console, false)]
    public void Package_CanBeLimitedToAStationType(StationType? packageType, StationType stationType, bool fits)
    {
        GamingPackage package = GamingPackage.Create(Guid.NewGuid(), Guid.NewGuid(), "ليلة", 360, 80m, packageType);

        package.FitsStation(stationType).Should().Be(fits);
    }
}
