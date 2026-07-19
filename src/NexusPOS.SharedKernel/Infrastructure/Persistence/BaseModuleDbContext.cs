using Microsoft.EntityFrameworkCore;

namespace NexusPOS.SharedKernel.Infrastructure.Persistence;

public abstract class BaseModuleDbContext(DbContextOptions options)
    : DbContext(options), IUnitOfWork
{
    public new async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        await base.SaveChangesAsync(cancellationToken);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
