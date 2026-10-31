using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Enums;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Infrastructure.Services;

internal sealed class TenantSubscriptionChecker(SuperAdminDbContext db) : ITenantSubscriptionChecker
{
    private const int FreeUserLimit = 3;

    public async Task<int?> GetMaxUsersAsync(Guid tenantId, CancellationToken ct)
    {
        var sub = await LiveSubscriptions(tenantId, DateTime.UtcNow).FirstOrDefaultAsync(ct);

        return sub?.MaxUsers ?? FreeUserLimit;
    }

    public async Task<IReadOnlyList<string>> GetFeaturesAsync(Guid tenantId, CancellationToken ct)
    {
        List<string> planFeatures = await LiveSubscriptions(tenantId, DateTime.UtcNow)
            .Select(s => s.Plan!.Features)
            .FirstOrDefaultAsync(ct) ?? [];

        bool aiEnabled = await db.TenantAiAccesses
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId)
            .Select(a => a.AiEnabled)
            .FirstOrDefaultAsync(ct);

        return aiEnabled
            ? PlanFeatures.Normalize(planFeatures.Append(PlanFeatures.Ai).Append(PlanFeatures.AiCashier))
            : PlanFeatures.Normalize(planFeatures);
    }

    // Same rule as TenantSubscription.IsLiveAt: not suspended/cancelled/expired and today within its dates.
    // A pre-paid renewal (stored as Trial until it starts) takes over as soon as its start date arrives.
    private IQueryable<TenantSubscription> LiveSubscriptions(Guid tenantId, DateTime now) =>
        db.TenantSubscriptions
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                && (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial)
                && s.StartDate <= now
                && s.ExpiryDate >= now)
            .OrderByDescending(s => s.ExpiryDate);
}
