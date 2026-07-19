using Microsoft.EntityFrameworkCore;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Infrastructure.Persistence;

public sealed class SuperAdminDbContext(DbContextOptions<SuperAdminDbContext> options)
    : DbContext(options), IUnitOfWork
{
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<TenantSubscription> TenantSubscriptions => Set<TenantSubscription>();

    public new async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        await base.SaveChangesAsync(cancellationToken);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("superadmin");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SuperAdminDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
