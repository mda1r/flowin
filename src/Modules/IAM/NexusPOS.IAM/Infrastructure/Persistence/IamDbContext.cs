using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.IAM.Infrastructure.Persistence;

public sealed class IamDbContext(DbContextOptions<IamDbContext> options, MediatR.IPublisher publisher)
    : BaseModuleDbContext(options, publisher)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasskeyCredential> PasskeyCredentials => Set<PasskeyCredential>();
    public DbSet<TOTPSecret> TotpSecrets => Set<TOTPSecret>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(IamDbContext).Assembly);
    }
}
