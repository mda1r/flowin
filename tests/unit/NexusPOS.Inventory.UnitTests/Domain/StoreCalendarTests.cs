using FluentAssertions;
using NexusPOS.Inventory.Domain.Services;

namespace NexusPOS.Inventory.UnitTests.Domain;

public sealed class StoreCalendarTests
{
    // Expiry dates arrive from the UI as UTC midnight of the picked day.
    private static readonly DateTime _expiry = new(2026, 11, 10, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void DaysUntilExpiry_EarlyMorningOfExpiryDayInRiyadh_IsToday()
    {
        // 10 Nov 05:00 in Riyadh: the item is still within its last day.
        DateTime utcNow = new(2026, 11, 10, 2, 0, 0, DateTimeKind.Utc);

        StoreCalendar.DaysUntilExpiry(_expiry, utcNow).Should().Be(0);
        StoreCalendar.IsExpired(_expiry, utcNow).Should().BeFalse();
    }

    [Fact]
    public void DaysUntilExpiry_LateEveningOfExpiryDayInRiyadh_IsStillToday()
    {
        // 10 Nov 23:30 in Riyadh.
        DateTime utcNow = new(2026, 11, 10, 20, 30, 0, DateTimeKind.Utc);

        StoreCalendar.DaysUntilExpiry(_expiry, utcNow).Should().Be(0);
    }

    [Fact]
    public void DaysUntilExpiry_AfterMidnightInRiyadh_IsExpired()
    {
        // 11 Nov 00:30 in Riyadh, still 10 Nov in UTC.
        DateTime utcNow = new(2026, 11, 10, 21, 30, 0, DateTimeKind.Utc);

        StoreCalendar.DaysUntilExpiry(_expiry, utcNow).Should().Be(-1);
        StoreCalendar.IsExpired(_expiry, utcNow).Should().BeTrue();
    }

    [Fact]
    public void DaysUntilExpiry_CountsWholeCalendarDays()
    {
        // 7 Nov 23:00 in Riyadh: three days left, not two.
        DateTime utcNow = new(2026, 11, 7, 20, 0, 0, DateTimeKind.Utc);

        StoreCalendar.DaysUntilExpiry(_expiry, utcNow).Should().Be(3);
    }

    [Fact]
    public void StartOfDayUtc_IsMidnightInRiyadh()
    {
        DateTime start = StoreCalendar.StartOfDayUtc(new DateOnly(2026, 11, 10));

        start.Should().Be(new DateTime(2026, 11, 9, 21, 0, 0, DateTimeKind.Utc));
        start.Kind.Should().Be(DateTimeKind.Utc);
    }
}
