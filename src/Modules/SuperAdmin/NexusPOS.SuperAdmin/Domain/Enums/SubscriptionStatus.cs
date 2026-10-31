namespace NexusPOS.SuperAdmin.Domain.Enums;

public enum SubscriptionStatus
{
    /// <summary>Starts in the future (pre-paid renewal or a scheduled plan).</summary>
    Trial = 0,
    Active = 1,
    Expired = 2,
    Suspended = 3,
    /// <summary>Replaced by a newer subscription before it started.</summary>
    Cancelled = 4,
}
