using NexusPOS.SuperAdmin.Domain.Enums;

namespace NexusPOS.SuperAdmin.Domain.Entities;

public sealed class TenantSubscription
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid PlanId { get; private set; }
    public DateTime StartDate { get; private set; }
    public DateTime ExpiryDate { get; private set; }
    public SubscriptionStatus Status { get; private set; }
    public int MaxBranches { get; private set; }
    public int MaxUsers { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public SubscriptionPlan? Plan { get; private set; }

    private TenantSubscription() { }

    public static TenantSubscription Create(
        Guid tenantId,
        Guid planId,
        DateTime startDate,
        DateTime expiryDate,
        int maxBranches,
        int maxUsers,
        string? notes = null)
    {
        return new TenantSubscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PlanId = planId,
            StartDate = startDate,
            ExpiryDate = expiryDate,
            Status = startDate <= DateTime.UtcNow ? SubscriptionStatus.Active : SubscriptionStatus.Trial,
            MaxBranches = maxBranches,
            MaxUsers = maxUsers,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
        };
    }

    /// <summary>
    /// The stored status only records admin decisions (suspend / cancel); whether a running
    /// subscription is upcoming, live or over is decided by its dates.
    /// </summary>
    public SubscriptionStatus EffectiveStatus(DateTime now)
    {
        if (Status is SubscriptionStatus.Suspended or SubscriptionStatus.Cancelled or SubscriptionStatus.Expired)
        {
            return Status;
        }

        if (now < StartDate)
        {
            return SubscriptionStatus.Trial;
        }

        return now <= ExpiryDate ? SubscriptionStatus.Active : SubscriptionStatus.Expired;
    }

    /// <summary>True while this subscription grants its plan's limits and features.</summary>
    public bool IsLiveAt(DateTime now) => EffectiveStatus(now) == SubscriptionStatus.Active;

    /// <summary>Not suspended, cancelled or expired: either live now or still to come.</summary>
    public bool IsRunning =>
        Status is SubscriptionStatus.Active or SubscriptionStatus.Trial;

    public void Suspend() => Status = SubscriptionStatus.Suspended;

    public void Activate()
    {
        Status = ExpiryDate >= DateTime.UtcNow
            ? SubscriptionStatus.Active
            : SubscriptionStatus.Expired;
    }

    public void UpdateExpiry(DateTime newExpiry)
    {
        ExpiryDate = newExpiry;
        if (Status == SubscriptionStatus.Expired && newExpiry >= DateTime.UtcNow)
        {
            Status = SubscriptionStatus.Active;
        }
    }

    /// <summary>
    /// Adds whole months to the end of the subscription. A subscription that already ended is
    /// extended from today rather than from its old expiry date.
    /// </summary>
    public void Extend(int months, DateTime now)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(months, 1);
        DateTime from = ExpiryDate > now ? ExpiryDate : now;
        UpdateExpiry(from.AddMonths(months));
    }

    /// <summary>
    /// Ends this subscription where a newer one begins so the two never overlap. One that had not
    /// started yet is cancelled outright.
    /// </summary>
    public void EndAt(DateTime at)
    {
        if (at <= StartDate)
        {
            Status = SubscriptionStatus.Cancelled;
            return;
        }

        if (at < ExpiryDate)
        {
            ExpiryDate = at;
        }
    }

    /// <summary>
    /// The subscription the console should show for a tenant: the live one, else a suspended one
    /// that still has time left, else the next upcoming one, else the most recently ended.
    /// </summary>
    public static TenantSubscription? PickCurrent(IEnumerable<TenantSubscription> subscriptions, DateTime now)
    {
        List<TenantSubscription> candidates = [.. subscriptions.Where(s => s.Status != SubscriptionStatus.Cancelled)];

        return candidates.Where(s => s.IsLiveAt(now)).MaxBy(s => s.ExpiryDate)
            ?? candidates.Where(s => s.Status == SubscriptionStatus.Suspended && s.ExpiryDate >= now).MaxBy(s => s.ExpiryDate)
            ?? candidates.Where(s => s.EffectiveStatus(now) == SubscriptionStatus.Trial).MinBy(s => s.StartDate)
            ?? candidates.MaxBy(s => s.ExpiryDate);
    }

    /// <summary>
    /// The subscription a renewal extends: the end of the chain (latest expiry, not cancelled).
    /// It differs from <see cref="PickCurrent"/> when a pre-paid period follows the live one.
    /// </summary>
    public static TenantSubscription? PickRenewable(IEnumerable<TenantSubscription> subscriptions) =>
        subscriptions.Where(s => s.Status != SubscriptionStatus.Cancelled).MaxBy(s => s.ExpiryDate);
}
