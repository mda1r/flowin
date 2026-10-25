namespace NexusPOS.SharedKernel.Application;

// Query-string dates bind as Local or Unspecified, which Npgsql refuses for timestamptz columns.
public static class UtcDates
{
    public static DateTime? AsUtc(DateTime? value) => value is null ? null : AsUtc(value.Value);

    public static DateTime AsUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}
