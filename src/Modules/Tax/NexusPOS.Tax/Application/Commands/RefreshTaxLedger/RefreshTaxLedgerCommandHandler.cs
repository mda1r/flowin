using System.Diagnostics.CodeAnalysis;
using ErrorOr;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.RefreshTaxLedger;

internal sealed class RefreshTaxLedgerCommandHandler(
    TaxConfigDbContext db,
    ILogger<RefreshTaxLedgerCommandHandler> logger)
    : ICommandHandler<RefreshTaxLedgerCommand, int>
{
    public async Task<ErrorOr<int>> Handle(
        RefreshTaxLedgerCommand request,
        CancellationToken cancellationToken)
    {
        // Held until commit, so a parallel sync of this period reads what this one wrote.
        await using IDbContextTransaction? periodLock =
            await TaxPeriodLock.AcquireAsync(db, request.PeriodId, cancellationToken);

        TaxPeriod? period = await db.TaxPeriods
            .AsNoTracking()
            .FirstOrDefaultAsync(
                p => p.Id == request.PeriodId && p.TenantId == request.TenantId,
                cancellationToken);

        if (period is null)
        {
            return TaxErrors.PeriodNotFound;
        }

        if (period.Status == TaxPeriodStatus.Closed)
        {
            return TaxErrors.PeriodClosed;
        }

        string schemaName = $"tenant_{request.TenantId:N}";
        ValidateSchemaName(schemaName);

        // The period's days are Riyadh calendar days; sales are stored in UTC.
        (DateTime startTs, DateTime endTs) = TaxPeriodClock.ToUtcRange(period.StartDate, period.EndDate);

        List<SourceTransaction> source;
        try
        {
            source = await QuerySourceTransactionsAsync(schemaName, startTs, endTs, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "RefreshTaxLedger: failed to read sales and returns for tenant {TenantId} period {PeriodId}",
                request.TenantId, request.PeriodId);
            return TaxErrors.LedgerSyncFailed;
        }

        List<TaxLedgerEntry> importedInPeriod = await db.TaxLedgerEntries
            .Where(e => e.TenantId == request.TenantId &&
                        e.PeriodId == request.PeriodId &&
                        (e.ReferenceType == LedgerReferenceType.SaleRecord || e.ReferenceType == LedgerReferenceType.ReturnOrder))
            .ToListAsync(cancellationToken);

        List<Guid> sourceIds = source.Select(s => s.Id).ToList();
        HashSet<Guid> importedElsewhere = [..await db.TaxLedgerEntries
            .Where(e => e.TenantId == request.TenantId &&
                        e.PeriodId != request.PeriodId &&
                        (e.ReferenceType == LedgerReferenceType.SaleRecord || e.ReferenceType == LedgerReferenceType.ReturnOrder) &&
                        e.ReferenceId != null &&
                        sourceIds.Contains(e.ReferenceId.Value))
            .Select(e => e.ReferenceId!.Value)
            .ToListAsync(cancellationToken)];

        LedgerSyncPlan plan = TaxLedgerSync.Plan(
            request.TenantId, request.PeriodId, source, importedInPeriod, importedElsewhere);

        // Outdated rows go first so their replacements never collide with them on ux_tax_ledger_import;
        // both saves share the lock's transaction.
        if (plan.ToRemove.Count > 0)
        {
            db.TaxLedgerEntries.RemoveRange(plan.ToRemove);
            await db.SaveChangesAsync(cancellationToken);
        }

        if (plan.ToAdd.Count > 0)
        {
            db.TaxLedgerEntries.AddRange(plan.ToAdd);
            await db.SaveChangesAsync(cancellationToken);
        }

        if (periodLock is not null)
        {
            await periodLock.CommitAsync(cancellationToken);
        }

        logger.LogInformation(
            "RefreshTaxLedger: added {Added} and removed {Removed} entries for tenant {TenantId} period {PeriodId}",
            plan.ToAdd.Count, plan.ToRemove.Count, request.TenantId, request.PeriodId);

        return plan.ToAdd.Count;
    }

    // Uses a dedicated ADO.NET connection with explicit search_path — the same mechanism
    // TenantSchemaInterceptor uses — so this works from any DbContext, including TaxConfigDbContext.
    private async Task<List<SourceTransaction>> QuerySourceTransactionsAsync(
        string schemaName, DateTime startTs, DateTime endTs,
        CancellationToken cancellationToken)
    {
        string connectionString = db.Database.GetConnectionString()
            ?? throw new InvalidOperationException("Connection string not configured.");

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(cancellationToken);

        // Mirror TenantSchemaInterceptor: set search_path before querying.
        await using (var pathCmd = conn.CreateCommand())
        {
            pathCmd.CommandText = $"SET search_path TO \"{schemaName}\", public";
            await pathCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        List<SourceTransaction> rows = [];

        await using (var salesCmd = conn.CreateCommand())
        {
            salesCmd.CommandText =
                """
                SELECT id, subtotal_amount, discount_amount, tax_amount, completed_at
                FROM sale_records
                WHERE completed_at >= $1
                  AND completed_at < $2
                """;
            AddRange(salesCmd, startTs, endTs);

            await using var reader = await salesCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                rows.Add(SourceTransaction.Sale(
                    reader.GetGuid(0),
                    reader.GetDecimal(1),
                    reader.GetDecimal(2),
                    reader.GetDecimal(3),
                    reader.GetDateTime(4)));
            }
        }

        // Refunds are credit notes: they take their VAT back out of the period they were issued in.
        await using (var returnsCmd = conn.CreateCommand())
        {
            returnsCmd.CommandText =
                """
                SELECT r.id, r.refund_amount, COALESCE(SUM(l.line_total), 0), r.created_at
                FROM return_orders r
                LEFT JOIN return_order_lines l ON l.return_order_id = r.id
                WHERE r.created_at >= $1
                  AND r.created_at < $2
                GROUP BY r.id, r.refund_amount, r.created_at
                """;
            AddRange(returnsCmd, startTs, endTs);

            await using var reader = await returnsCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                rows.Add(SourceTransaction.Return(
                    reader.GetGuid(0),
                    reader.GetDecimal(1),
                    reader.GetDecimal(2),
                    reader.GetDateTime(3)));
            }
        }

        return rows;
    }

    private static void AddRange(NpgsqlCommand cmd, DateTime startTs, DateTime endTs)
    {
        cmd.Parameters.Add(new NpgsqlParameter<DateTime> { TypedValue = startTs, NpgsqlDbType = NpgsqlDbType.TimestampTz });
        cmd.Parameters.Add(new NpgsqlParameter<DateTime> { TypedValue = endTs, NpgsqlDbType = NpgsqlDbType.TimestampTz });
    }

    [SuppressMessage("Security", "CA2100", Justification = "Schema name validated against strict pattern.")]
    private static void ValidateSchemaName(string schemaName)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(schemaName, @"^[a-z0-9_]+$"))
        {
            throw new InvalidOperationException($"Invalid schema name: {schemaName}");
        }
    }
}
