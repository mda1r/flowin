using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Common;

// One writer per period at a time: a ledger sync and a period close for the same period wait for each other,
// so two syncs never import the same sale twice and a close never locks half-synced figures.
internal static class TaxPeriodLock
{
    // Returns the transaction that holds the lock (commit it to release), or null where there is no PostgreSQL to lock on.
    public static async Task<IDbContextTransaction?> AcquireAsync(
        TaxConfigDbContext db, Guid periodId, CancellationToken cancellationToken)
    {
        if (!db.Database.IsNpgsql())
        {
            return null;
        }

        IDbContextTransaction tx = await db.Database.BeginTransactionAsync(cancellationToken);
        string key = $"tax_period:{periodId:N}";
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({key}))", cancellationToken);
        return tx;
    }
}
