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
}
