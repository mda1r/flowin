namespace NexusPOS.POS.Domain.ValueObjects;

// Comparable so the activity log can break timestamp ties by id when paging.
public sealed record ActivityLogId(Guid Value) : IComparable<ActivityLogId>
{
    public int CompareTo(ActivityLogId? other) => other is null ? 1 : Value.CompareTo(other.Value);

    public static bool operator <(ActivityLogId left, ActivityLogId right) => left.CompareTo(right) < 0;
    public static bool operator <=(ActivityLogId left, ActivityLogId right) => left.CompareTo(right) <= 0;
    public static bool operator >(ActivityLogId left, ActivityLogId right) => left.CompareTo(right) > 0;
    public static bool operator >=(ActivityLogId left, ActivityLogId right) => left.CompareTo(right) >= 0;
}
