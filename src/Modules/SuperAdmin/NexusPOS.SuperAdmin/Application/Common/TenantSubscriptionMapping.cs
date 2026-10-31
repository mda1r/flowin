using NexusPOS.SuperAdmin.Domain.Entities;

namespace NexusPOS.SuperAdmin.Application.Common;

internal static class TenantSubscriptionMapping
{
    /// <summary>Maps with the date-derived status, so an elapsed subscription reads as Expired.</summary>
    public static TenantSubscriptionResponse ToResponse(this TenantSubscription sub, DateTime now, SubscriptionPlan? plan = null)
    {
        plan ??= sub.Plan;
        int daysRemaining = (int)(sub.ExpiryDate - now).TotalDays;

        return new TenantSubscriptionResponse(
            sub.Id,
            sub.TenantId,
            sub.PlanId,
            plan?.Name ?? string.Empty,
            plan?.Price ?? 0,
            sub.StartDate,
            sub.ExpiryDate,
            sub.EffectiveStatus(now),
            sub.MaxBranches,
            sub.MaxUsers,
            sub.Notes,
            sub.CreatedAt,
            daysRemaining);
    }
}
