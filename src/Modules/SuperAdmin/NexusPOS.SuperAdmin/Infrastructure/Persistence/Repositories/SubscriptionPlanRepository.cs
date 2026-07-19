using Microsoft.EntityFrameworkCore;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Repositories;

namespace NexusPOS.SuperAdmin.Infrastructure.Persistence.Repositories;

internal sealed class SubscriptionPlanRepository(SuperAdminDbContext context) : ISubscriptionPlanRepository
{
    public async Task<List<SubscriptionPlan>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await context.SubscriptionPlans
            .AsNoTracking()
            .OrderBy(p => p.Price)
            .ToListAsync(cancellationToken);

    public async Task<SubscriptionPlan?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        await context.SubscriptionPlans
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public void Add(SubscriptionPlan plan) => context.SubscriptionPlans.Add(plan);
}
