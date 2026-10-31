namespace NexusPOS.Tax.Application.Common;

// Tax periods are calendar days in Saudi time, while sales are stored in UTC.
// Riyadh has no daylight saving, so a fixed UTC+3 zone is a safe fallback when tzdata is missing.
internal static class TaxPeriodClock
{
    private static readonly TimeZoneInfo _riyadh = ResolveRiyadh();

    // [start of StartDate, start of the day after EndDate) in UTC.
    public static (DateTime StartUtc, DateTime EndUtcExclusive) ToUtcRange(DateOnly startDate, DateOnly endDate)
    {
        DateTime startLocal = startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        DateTime endLocal = endDate.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return (TimeZoneInfo.ConvertTimeToUtc(startLocal, _riyadh), TimeZoneInfo.ConvertTimeToUtc(endLocal, _riyadh));
    }

    public static DateOnly ToLocalDate(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), _riyadh));

    private static TimeZoneInfo ResolveRiyadh()
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Riyadh", out TimeZoneInfo? zone) ||
            TimeZoneInfo.TryFindSystemTimeZoneById("Arab Standard Time", out zone))
        {
            return zone;
        }

        return TimeZoneInfo.CreateCustomTimeZone("Asia/Riyadh", TimeSpan.FromHours(3), "Riyadh", "Riyadh");
    }
}
