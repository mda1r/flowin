using Microsoft.EntityFrameworkCore;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Gaming.Infrastructure.Persistence;

public sealed class GamingDbContext(DbContextOptions<GamingDbContext> options, MediatR.IPublisher publisher)
    : BaseModuleDbContext(options, publisher)
{
    public DbSet<GameStation> GameStations => Set<GameStation>();
    public DbSet<GameSession> GameSessions => Set<GameSession>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GamingDbContext).Assembly);
    }
}
