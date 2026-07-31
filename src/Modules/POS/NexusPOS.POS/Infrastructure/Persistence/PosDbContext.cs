using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.POS.Infrastructure.Persistence;

public sealed class PosDbContext(DbContextOptions<PosDbContext> options)
    : BaseModuleDbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<ReturnOrder> ReturnOrders => Set<ReturnOrder>();
    public DbSet<ReturnOrderLine> ReturnOrderLines => Set<ReturnOrderLine>();
    public DbSet<CashierShift> CashierShifts => Set<CashierShift>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PosDbContext).Assembly);
    }
}
