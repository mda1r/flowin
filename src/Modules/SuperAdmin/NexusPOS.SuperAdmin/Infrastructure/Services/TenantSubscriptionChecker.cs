using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SuperAdmin.Domain.Enums;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Infrastructure.Services;

internal sealed class TenantSubscriptionChecker(SuperAdminDbContext db) : ITenantSubscriptionChecker
{
    private const int FreeUserLimit = 3;

    public async Task<int?> GetMaxUsersAsync(Guid tenantId, CancellationToken ct)
    {
        var sub = await db.TenantSubscriptions
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.ExpiryDate)
            .FirstOrDefaultAsync(ct);

        return sub?.MaxUsers ?? FreeUserLimit;
    }

    public async Task<IReadOnlyList<string>> GetFeaturesAsync(Guid tenantId, CancellationToken ct)
    {
        List<string> planFeatures = await db.TenantSubscriptions
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.ExpiryDate)
            .Select(s => s.Plan!.Features)
            .FirstOrDefaultAsync(ct) ?? [];

        bool aiEnabled = await db.TenantAiAccesses
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId)
            .Select(a => a.AiEnabled)
            .FirstOrDefaultAsync(ct);

        return aiEnabled
            ? [.. planFeatures.Union(["ai", "ai_cashier"])]
            : planFeatures;
    }
}
