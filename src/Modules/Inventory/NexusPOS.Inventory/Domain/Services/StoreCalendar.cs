namespace NexusPOS.Inventory.Domain.Services;

// Calendar days as the store sees them: Riyadh time (UTC+3, no daylight saving).
// Expiry dates are days picked in the UI and stored as UTC midnight of that day, so an item counts as
// expiring "today" for the whole of its expiry day and as expired from the next day.
public static class StoreCalendar
{
    private static readonly TimeSpan _riyadhOffset = TimeSpan.FromHours(3);

    public static DateOnly Today(DateTime utcNow) => DateOnly.FromDateTime(utcNow + _riyadhOffset);

    public static int DaysUntilExpiry(DateTime expiryDate, DateTime utcNow) =>
        DateOnly.FromDateTime(expiryDate).DayNumber - Today(utcNow).DayNumber;

    public static bool IsExpired(DateTime expiryDate, DateTime utcNow) => DaysUntilExpiry(expiryDate, utcNow) < 0;

    // The UTC instant at which the given Riyadh day starts.
    public static DateTime StartOfDayUtc(DateOnly day) =>
        DateTime.SpecifyKind(day.ToDateTime(TimeOnly.MinValue) - _riyadhOffset, DateTimeKind.Utc);
}
