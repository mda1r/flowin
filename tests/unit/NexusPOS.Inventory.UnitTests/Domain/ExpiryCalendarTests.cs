using FluentAssertions;
using NexusPOS.Inventory.Domain.Services;

namespace NexusPOS.Inventory.UnitTests.Domain;

public sealed class ExpiryCalendarTests
{
    // Expiry dates are saved from a date picker as midnight UTC of the chosen day.
    private static DateTime Expiry(int year, int month, int day) => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);

    private static DateTime Utc(int year, int month, int day, int hour) => new(year, month, day, hour, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void DaysUntilExpiry_ItemThatExpiredYesterday_IsNegativeNotToday()
    {
        // Expired on the 30th; checked at 10:00 UTC on the 31st (13:00 Riyadh). Truncation used to give 0.
        int days = ExpiryCalendar.DaysUntilExpiry(Expiry(2026, 10, 30), Utc(2026, 10, 31, 10));

        days.Should().Be(-1);
        ExpiryCalendar.IsExpired(Expiry(2026, 10, 30), Utc(2026, 10, 31, 10)).Should().BeTrue();
    }

    [Fact]
    public void DaysUntilExpiry_ItemExpiringTomorrow_IsOne()
    {
        int days = ExpiryCalendar.DaysUntilExpiry(Expiry(2026, 11, 1), Utc(2026, 10, 31, 10));

        days.Should().Be(1);
    }

    [Fact]
    public void ItemExpiringToday_IsNotExpiredUntilTheDayEnds()
    {
        // 03:00 Riyadh on the expiry day used to count as expired because the stored instant had passed.
        DateTime expiry = Expiry(2026, 10, 31);

        ExpiryCalendar.DaysUntilExpiry(expiry, Utc(2026, 10, 31, 0)).Should().Be(0);
        ExpiryCalendar.IsExpired(expiry, Utc(2026, 10, 31, 20)).Should().BeFalse();

        // 21:00 UTC is midnight in Riyadh: the next day has started.
        ExpiryCalendar.IsExpired(expiry, Utc(2026, 10, 31, 21)).Should().BeTrue();
    }

    [Fact]
    public void LocalDate_UsesRiyadhDay()
    {
        ExpiryCalendar.LocalDate(Utc(2026, 10, 31, 20)).Should().Be(new DateOnly(2026, 10, 31));
        ExpiryCalendar.LocalDate(Utc(2026, 10, 31, 22)).Should().Be(new DateOnly(2026, 11, 1));
    }

    [Theory]
    [InlineData(7, 7, true)]
    [InlineData(8, 7, false)]
    [InlineData(0, 1, true)]
    [InlineData(-3, 1, true)]
    [InlineData(2, 1, false)]
    public void IsDue_RespectsWindowAndAlwaysIncludesExpired(int daysFromToday, int windowDays, bool expected)
    {
        DateTime now = Utc(2026, 10, 31, 9);
        DateTime expiry = Expiry(2026, 10, 31).AddDays(daysFromToday);

        ExpiryCalendar.IsDue(expiry, now, windowDays).Should().Be(expected);
    }
}
