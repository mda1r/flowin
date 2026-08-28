using Microsoft.EntityFrameworkCore;
using NexusPOS.Tax.Domain.Entities;

namespace NexusPOS.Tax.Infrastructure.Persistence;

// Non-tenant-scoped context for cross-tenant tax configuration.
// Uses a fixed 'tax_config' schema. No TenantSchemaInterceptor.
// Per-tenant tax data (periods, ledger, anomalies) is also stored here,
// filtered by tenant_id which is always derived from the authenticated JWT.
public sealed class TaxConfigDbContext(DbContextOptions<TaxConfigDbContext> options)
    : DbContext(options)
{
    public DbSet<TaxRegistrationScope> TaxRegistrationScopes => Set<TaxRegistrationScope>();
    public DbSet<TaxScopeMembership> TaxScopeMemberships => Set<TaxScopeMembership>();
    public DbSet<TaxPeriod> TaxPeriods => Set<TaxPeriod>();
    public DbSet<TaxLedgerEntry> TaxLedgerEntries => Set<TaxLedgerEntry>();
    public DbSet<TaxAnomaly> TaxAnomalies => Set<TaxAnomaly>();
    public DbSet<TaxExpenseInvoice> TaxExpenseInvoices => Set<TaxExpenseInvoice>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("tax_config");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TaxConfigDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }

    public new async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        await base.SaveChangesAsync(cancellationToken);
}
