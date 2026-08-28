using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Queries.GetTaxOverview;

internal sealed class GetTaxOverviewQueryHandler(TaxConfigDbContext db)
    : IQueryHandler<GetTaxOverviewQuery, TaxOverviewResponse>
{
    public async Task<ErrorOr<TaxOverviewResponse>> Handle(
        GetTaxOverviewQuery request,
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

        List<TaxLedgerEntry> entries = await db.TaxLedgerEntries
            .AsNoTracking()
            .Where(e => e.TenantId == request.TenantId && e.PeriodId == request.PeriodId)
            .ToListAsync(cancellationToken);

        int openAnomalyCount = await db.TaxAnomalies
            .AsNoTracking()
            .CountAsync(
                a => a.TenantId == request.TenantId &&
                     a.PeriodId == request.PeriodId &&
                     !a.IsResolved,
                cancellationToken);

        List<TaxLedgerEntry> outputEntries = entries.Where(e => e.EntryType == LedgerEntryType.Output).ToList();
        List<TaxLedgerEntry> inputEntries = entries.Where(e => e.EntryType == LedgerEntryType.Input).ToList();

        decimal totalOutputVat = outputEntries.Sum(e => e.TaxAmount);
        decimal totalInputVat = inputEntries.Sum(e => e.TaxAmount);
        decimal totalSalesBase = outputEntries.Sum(e => e.BaseAmount);
        decimal totalPurchasesBase = inputEntries.Sum(e => e.BaseAmount);
        int saleCount = outputEntries.Count(e => e.TransactionType == LedgerTransactionType.Sale);
        int purchaseCount = inputEntries.Count(e => e.TransactionType == LedgerTransactionType.PurchaseInvoice);

        // Readiness score: 0-100 based on completeness and anomalies
        decimal readiness = ComputeReadiness(entries, openAnomalyCount, period);

        return new TaxOverviewResponse(
            period.Id,
            period.StartDate,
            period.EndDate,
            period.Status,
            totalOutputVat,
            totalInputVat,
            totalOutputVat - totalInputVat,
            totalSalesBase,
            totalPurchasesBase,
            saleCount,
            purchaseCount,
            openAnomalyCount,
            readiness);
    }

    private static decimal ComputeReadiness(
        List<TaxLedgerEntry> entries,
        int openAnomalies,
        TaxPeriod period)
    {
        decimal score = 100m;

        if (entries.Count == 0)
        {
            score -= 40m;
        }

        score -= Math.Min(openAnomalies * 10m, 40m);

        if (period.Status == TaxPeriodStatus.Closed)
        {
            score = 100m;
        }

        return Math.Max(0m, Math.Min(100m, score));
    }
}
