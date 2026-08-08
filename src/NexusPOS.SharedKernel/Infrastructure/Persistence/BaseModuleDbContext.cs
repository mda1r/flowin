using MediatR;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.SharedKernel.Infrastructure.Persistence;

public abstract class BaseModuleDbContext(DbContextOptions options, IPublisher publisher)
    : DbContext(options), IUnitOfWork
{
    public new async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        int result = await base.SaveChangesAsync(cancellationToken);

        List<IAggregateRoot> aggregates = ChangeTracker
            .Entries<IAggregateRoot>()
            .Where(e => e.Entity.DomainEvents.Count > 0)
            .Select(e => e.Entity)
            .ToList();

        List<IDomainEvent> events = aggregates
            .SelectMany(a => a.DomainEvents)
            .ToList();

        foreach (IAggregateRoot aggregate in aggregates)
        {
            aggregate.ClearDomainEvents();
        }

        foreach (IDomainEvent domainEvent in events)
        {
            await publisher.Publish(domainEvent, cancellationToken);
        }

        return result;
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
