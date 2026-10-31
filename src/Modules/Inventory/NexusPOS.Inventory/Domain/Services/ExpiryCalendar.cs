namespace NexusPOS.Inventory.Domain.Services;

// Expiry is a calendar date in the shop's day (Asia/Riyadh), not an instant: an item whose expiry date is
// today is still sellable today and only counts as expired from tomorrow.
public static class ExpiryCalendar
{
    private static readonly TimeZoneInfo _riyadh = ResolveRiyadh();

    public static DateOnly LocalDate(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
            utc.Kind == DateTimeKind.Local ? utc.ToUniversalTime() : DateTime.SpecifyKind(utc, DateTimeKind.Utc),
            _riyadh));

    // Whole days from today to the expiry date: 0 = expires today, 1 = tomorrow, negative = already expired.
    public static int DaysUntilExpiry(DateTime expiryDate, DateTime utcNow) =>
        LocalDate(expiryDate).DayNumber - LocalDate(utcNow).DayNumber;

    public static bool IsExpired(DateTime expiryDate, DateTime utcNow) =>
        DaysUntilExpiry(expiryDate, utcNow) < 0;

    // Expired items are always due; otherwise the item is due once it is inside its notification window.
    public static bool IsDue(DateTime expiryDate, DateTime utcNow, int windowDays) =>
        DaysUntilExpiry(expiryDate, utcNow) <= windowDays;

    private static TimeZoneInfo ResolveRiyadh()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Riyadh");
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            // Saudi Arabia is UTC+3 all year with no daylight saving, so a fixed offset is exact.
            return TimeZoneInfo.CreateCustomTimeZone("Asia/Riyadh", TimeSpan.FromHours(3), "Asia/Riyadh", "Asia/Riyadh");
        }
    }
}
