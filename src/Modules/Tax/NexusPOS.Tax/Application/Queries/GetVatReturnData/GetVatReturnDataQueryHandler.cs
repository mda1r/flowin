using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Queries.GetVatReturnData;

internal sealed class GetVatReturnDataQueryHandler(TaxConfigDbContext db)
    : IQueryHandler<GetVatReturnDataQuery, VatReturnResponse>
{
    public async Task<ErrorOr<VatReturnResponse>> Handle(
        GetVatReturnDataQuery request,
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

        // ZATCA Form 15 — simplified version
        // Box 1: Standard-rated domestic sales (15% VAT)
        List<TaxLedgerEntry> standardSales = entries
            .Where(e => e.EntryType == LedgerEntryType.Output &&
                        Math.Abs(e.TaxRate - 0.15m) < 0.001m)
            .ToList();

        // Box 2: Zero-rated domestic sales
        List<TaxLedgerEntry> zeroRatedSales = entries
            .Where(e => e.EntryType == LedgerEntryType.Output && e.TaxRate == 0m)
            .ToList();

        // Box 6: Standard-rated purchases/expenses (15% input VAT)
        List<TaxLedgerEntry> standardPurchases = entries
            .Where(e => e.EntryType == LedgerEntryType.Input &&
                        Math.Abs(e.TaxRate - 0.15m) < 0.001m)
            .ToList();

        // Box 7: Zero-rated purchases
        List<TaxLedgerEntry> zeroRatedPurchases = entries
            .Where(e => e.EntryType == LedgerEntryType.Input && e.TaxRate == 0m)
            .ToList();

        decimal box1Sales = standardSales.Sum(e => e.BaseAmount);
        decimal box1OutputVat = standardSales.Sum(e => e.TaxAmount);
        decimal box2ZeroRated = zeroRatedSales.Sum(e => e.BaseAmount);
        decimal box6Purchases = standardPurchases.Sum(e => e.BaseAmount);
        decimal box6InputVat = standardPurchases.Sum(e => e.TaxAmount);
        decimal box7ZeroRatedPurchases = zeroRatedPurchases.Sum(e => e.BaseAmount);

        // Totals take every entry, so VAT at an unexpected rate (flagged by the anomaly scan) still counts
        // towards what is payable and matches the overview.
        decimal box9TotalOutputVat = entries.Where(e => e.EntryType == LedgerEntryType.Output).Sum(e => e.TaxAmount);
        decimal box10TotalInputVat = entries.Where(e => e.EntryType == LedgerEntryType.Input).Sum(e => e.TaxAmount);

        return new VatReturnResponse(
            period.Id,
            period.StartDate,
            period.EndDate,
            box1Sales,
            box1OutputVat,
            box2ZeroRated,
            0m, // Box 3: Exempt sales (not tracked separately yet)
            box6Purchases,
            box6InputVat,
            box7ZeroRatedPurchases,
            0m, // Box 8: Exempt purchases
            box9TotalOutputVat, // Box 9: Total output VAT
            box10TotalInputVat, // Box 10: Total input VAT (claimable)
            box9TotalOutputVat - box10TotalInputVat, // Box 11: Net VAT due
            period.Status);
    }
}
