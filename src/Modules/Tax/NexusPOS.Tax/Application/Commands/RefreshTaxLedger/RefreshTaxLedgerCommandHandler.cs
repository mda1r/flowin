using System.Diagnostics.CodeAnalysis;
using ErrorOr;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using NexusPOS.SharedKernel.Application.Messaging;
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
        TaxPeriod? period = await db.TaxPeriods
            .AsNoTracking()
            .FirstOrDefaultAsync(
                p => p.Id == request.PeriodId && p.TenantId == request.TenantId,
                cancellationToken);

        if (period is null)
        {
            return Error.NotFound("TaxPeriod.NotFound", "Tax period not found.");
        }

        string schemaName = $"tenant_{request.TenantId:N}";
        ValidateSchemaName(schemaName);

        // Use UTC so Npgsql 9 can bind against timestamptz columns without throwing.
        DateTime startTs = DateTime.SpecifyKind(period.StartDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        DateTime endTs = DateTime.SpecifyKind(period.EndDate.ToDateTime(TimeOnly.MaxValue), DateTimeKind.Utc);

        List<SaleRow> sales;
        try
        {
            sales = await QuerySaleRowsAsync(schemaName, startTs, endTs, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "RefreshTaxLedger: failed to read sale_records for tenant {TenantId} period {PeriodId}",
                request.TenantId, request.PeriodId);
            return 0;
        }

        HashSet<Guid> existingRefs = [..await db.TaxLedgerEntries
            .Where(e => e.TenantId == request.TenantId &&
                        e.PeriodId == request.PeriodId &&
                        e.TransactionType == LedgerTransactionType.Sale)
            .Select(e => e.ReferenceId!.Value)
            .ToListAsync(cancellationToken)];

        List<TaxLedgerEntry> newEntries = [];
        const decimal standardVatRate = 0.15m;

        foreach (SaleRow row in sales)
        {
            if (existingRefs.Contains(row.Id) || row.TaxAmount <= 0)
            {
                continue;
            }

            newEntries.Add(TaxLedgerEntry.Create(
                request.TenantId,
                request.PeriodId,
                LedgerEntryType.Output,
                LedgerTransactionType.Sale,
                row.SubtotalAmount,
                row.TaxAmount,
                standardVatRate,
                DateOnly.FromDateTime(row.CompletedAt),
                row.Id,
                "SaleRecord"));
        }

        if (newEntries.Count > 0)
        {
            db.TaxLedgerEntries.AddRange(newEntries);
            await db.SaveChangesAsync(cancellationToken);
        }

        logger.LogInformation(
            "RefreshTaxLedger: imported {Count} new sale entries for tenant {TenantId} period {PeriodId}",
            newEntries.Count, request.TenantId, request.PeriodId);

        return newEntries.Count;
    }

    // Uses a dedicated ADO.NET connection with explicit search_path — the same mechanism
    // TenantSchemaInterceptor uses — so this works from any DbContext, including TaxConfigDbContext.
    private async Task<List<SaleRow>> QuerySaleRowsAsync(
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

        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            SELECT id, tax_amount, subtotal_amount, completed_at
            FROM sale_records
            WHERE completed_at >= $1
              AND completed_at <= $2
            """;

        cmd.Parameters.Add(new NpgsqlParameter<DateTime> { TypedValue = startTs, NpgsqlDbType = NpgsqlDbType.TimestampTz });
        cmd.Parameters.Add(new NpgsqlParameter<DateTime> { TypedValue = endTs, NpgsqlDbType = NpgsqlDbType.TimestampTz });

        List<SaleRow> rows = [];
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(new SaleRow(
                reader.GetGuid(0),
                reader.GetDecimal(1),
                reader.GetDecimal(2),
                reader.GetDateTime(3)));
        }

        return rows;
    }

    [SuppressMessage("Security", "CA2100", Justification = "Schema name validated against strict pattern.")]
    private static void ValidateSchemaName(string schemaName)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(schemaName, @"^[a-z0-9_]+$"))
        {
            throw new InvalidOperationException($"Invalid schema name: {schemaName}");
        }
    }

    private sealed record SaleRow(Guid Id, decimal TaxAmount, decimal SubtotalAmount, DateTime CompletedAt);
}
