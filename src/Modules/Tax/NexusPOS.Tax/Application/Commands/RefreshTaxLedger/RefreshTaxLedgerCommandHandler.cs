using System.Diagnostics.CodeAnalysis;
using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.RefreshTaxLedger;

internal sealed class RefreshTaxLedgerCommandHandler(TaxConfigDbContext db)
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

        DateTime startTs = period.StartDate.ToDateTime(TimeOnly.MinValue);
        DateTime endTs = period.EndDate.ToDateTime(TimeOnly.MaxValue);

        List<SaleRow> sales;
        try
        {
            sales = await db.Database
                .SqlQuery<SaleRow>(
                    $"""
                     SELECT id, tax_amount, subtotal_amount, completed_at
                     FROM "{schemaName}".sale_records
                     WHERE completed_at >= {startTs}
                       AND completed_at <= {endTs}
                     """)
                .ToListAsync(cancellationToken);
        }
        catch
        {
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

        return newEntries.Count;
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
