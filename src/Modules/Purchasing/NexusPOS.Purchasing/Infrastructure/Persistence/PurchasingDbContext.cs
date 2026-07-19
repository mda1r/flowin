using Microsoft.EntityFrameworkCore;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Purchasing.Infrastructure.Persistence;

public sealed class PurchasingDbContext(DbContextOptions<PurchasingDbContext> options)
    : BaseModuleDbContext(options)
{
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PurchasingDbContext).Assembly);
    }
}
