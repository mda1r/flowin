using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.ScanAnomalies;

internal sealed class ScanAnomaliesCommandHandler(TaxConfigDbContext db)
    : ICommandHandler<ScanAnomaliesCommand, int>
{
    private const decimal StandardVatRate = 0.15m;
    private const decimal LargeTransactionThreshold = 100_000m;

    public async Task<ErrorOr<int>> Handle(
        ScanAnomaliesCommand request,
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

        List<TaxExpenseInvoice> expenses = await db.TaxExpenseInvoices
            .AsNoTracking()
            .Where(e => e.TenantId == request.TenantId && e.PeriodId == request.PeriodId)
            .ToListAsync(cancellationToken);

        // Clear existing unresolved anomalies for this period
        List<TaxAnomaly> existing = await db.TaxAnomalies
            .Where(a => a.TenantId == request.TenantId &&
                        a.PeriodId == request.PeriodId &&
                        !a.IsResolved)
            .ToListAsync(cancellationToken);

        db.TaxAnomalies.RemoveRange(existing);

        List<TaxAnomaly> anomalies = [];

        // Rule TAX-001: Zero-tax sales that appear to have taxable amounts
        List<TaxLedgerEntry> zeroTaxSales = entries
            .Where(e => e.EntryType == LedgerEntryType.Output &&
                        e.TransactionType == LedgerTransactionType.Sale &&
                        e.TaxAmount == 0 &&
                        e.BaseAmount > 1000)
            .ToList();

        if (zeroTaxSales.Count > 0)
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-001", AnomalySeverity.Warning,
                "Zero-VAT sales with significant amounts",
                $"{zeroTaxSales.Count} sale(s) recorded with zero VAT on amounts exceeding 1,000 SAR. Verify these are legitimately zero-rated or exempt."));
        }

        // Rule TAX-002: Incorrect VAT rate (not 15%, not 0%)
        List<TaxLedgerEntry> wrongRate = entries
            .Where(e => e.TaxAmount > 0 &&
                        Math.Abs(e.TaxRate - StandardVatRate) > 0.001m &&
                        Math.Abs(e.TaxRate) > 0.001m)
            .ToList();

        foreach (TaxLedgerEntry entry in wrongRate)
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-002", AnomalySeverity.Error,
                "Non-standard VAT rate detected",
                $"Transaction with rate {entry.TaxRate:P1} (expected 15% or 0%). Base: {entry.BaseAmount:N2} SAR, Tax: {entry.TaxAmount:N2} SAR.",
                entry.ReferenceId?.ToString()));
        }

        // Rule TAX-003: VAT amount doesn't match base × rate
        List<TaxLedgerEntry> miscalculated = entries
            .Where(e => e.TaxAmount > 0 &&
                        Math.Abs(e.TaxAmount - Math.Round(e.BaseAmount * e.TaxRate, 4)) > 0.05m)
            .ToList();

        if (miscalculated.Count > 0)
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-003", AnomalySeverity.Error,
                "VAT amount doesn't match base × rate",
                $"{miscalculated.Count} transaction(s) have a VAT amount that doesn't equal base amount × rate. Possible rounding or calculation error."));
        }

        // Rule TAX-004: Large transactions exceeding threshold
        List<TaxLedgerEntry> largeTransactions = entries
            .Where(e => e.BaseAmount + e.TaxAmount > LargeTransactionThreshold)
            .ToList();

        if (largeTransactions.Count > 0)
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-004", AnomalySeverity.Info,
                "Large transactions detected",
                $"{largeTransactions.Count} transaction(s) exceed 100,000 SAR total. Ensure e-invoicing compliance (ZATCA Phase 2) for B2B transactions."));
        }

        // Rule TAX-005: Expense invoices without supplier VAT number
        List<TaxExpenseInvoice> noVatNumber = expenses
            .Where(e => string.IsNullOrEmpty(e.SupplierVatNumber) && e.TaxAmount > 0)
            .ToList();

        if (noVatNumber.Count > 0)
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-005", AnomalySeverity.Warning,
                "Expense invoices missing supplier VAT number",
                $"{noVatNumber.Count} expense invoice(s) with input VAT are missing the supplier's VAT registration number. Input VAT may not be claimable without this."));
        }

        // Rule TAX-006: Duplicate invoice numbers in expenses
        List<string> invoiceNumbers = expenses.Select(e => e.InvoiceNumber).ToList();
        List<string> duplicateNumbers = invoiceNumbers
            .GroupBy(n => n)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (duplicateNumbers.Count > 0)
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-006", AnomalySeverity.Error,
                "Duplicate supplier invoice numbers",
                $"Invoice number(s) appear more than once: {string.Join(", ", duplicateNumbers)}. Remove duplicates to avoid double-claiming input VAT."));
        }

        // Rule TAX-007: No sales transactions in period
        List<TaxLedgerEntry> salesEntries = entries
            .Where(e => e.EntryType == LedgerEntryType.Output)
            .ToList();

        if (salesEntries.Count == 0 && period.Status == TaxPeriodStatus.Open)
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-007", AnomalySeverity.Warning,
                "No sales recorded in tax period",
                "No output VAT transactions found for this period. Run 'Refresh Ledger' to sync sales data, or verify the period dates are correct."));
        }

        // Rule TAX-008: Input VAT exceeds output VAT by large margin (refund trigger)
        decimal totalOutput = entries.Where(e => e.EntryType == LedgerEntryType.Output).Sum(e => e.TaxAmount);
        decimal totalInput = entries.Where(e => e.EntryType == LedgerEntryType.Input).Sum(e => e.TaxAmount);

        if (totalInput > totalOutput * 2 && totalOutput > 0)
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-008", AnomalySeverity.Info,
                "Input VAT significantly exceeds output VAT",
                $"Input VAT ({totalInput:N2} SAR) is more than double the output VAT ({totalOutput:N2} SAR). You may be entitled to a VAT refund from ZATCA."));
        }

        // Rule TAX-009: Negative base amounts (returns/credits)
        List<TaxLedgerEntry> negativeBase = entries.Where(e => e.BaseAmount < 0).ToList();

        if (negativeBase.Count > 0)
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-009", AnomalySeverity.Info,
                "Credit notes/returns detected",
                $"{negativeBase.Count} transaction(s) with negative amounts (returns or credit notes). Verify these are correctly reported in your VAT return."));
        }

        // Rule TAX-010: Period close check — any open period older than 3 months
        if (period.Status == TaxPeriodStatus.Open &&
            period.EndDate < DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-3)))
        {
            anomalies.Add(TaxAnomaly.Create(
                request.TenantId, request.PeriodId,
                "TAX-010", AnomalySeverity.Error,
                "Overdue VAT period — not yet filed",
                $"This period ended on {period.EndDate:d MMM yyyy} and is still open. ZATCA requires VAT returns to be filed within 30 days of period end. This period is overdue."));
        }

        if (anomalies.Count > 0)
        {
            db.TaxAnomalies.AddRange(anomalies);
        }

        await db.SaveChangesAsync(cancellationToken);
        return anomalies.Count;
    }
}
