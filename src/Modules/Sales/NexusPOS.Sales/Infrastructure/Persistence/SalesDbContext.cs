using Microsoft.EntityFrameworkCore;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Sales.Infrastructure.Persistence;

public sealed class SalesDbContext(DbContextOptions<SalesDbContext> options)
    : BaseModuleDbContext(options)
{
    public DbSet<SaleRecord> SaleRecords => Set<SaleRecord>();
    public DbSet<SalesSummary> SalesSummaries => Set<SalesSummary>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SalesDbContext).Assembly);
    }
}
