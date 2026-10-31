using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain.Entities;

namespace NexusPOS.Tax.Application.Commands.RefreshTaxLedger;

// A completed sale or a refund read from the tenant's POS tables. Amounts are net of VAT;
// refunds arrive with negative base and VAT so they reduce the period's output tax.
internal sealed record SourceTransaction(
    Guid Id,
    string TransactionType,
    string ReferenceType,
    decimal BaseAmount,
    decimal TaxAmount,
    DateTime OccurredAtUtc)
{
    public static SourceTransaction Sale(Guid id, decimal subtotal, decimal discount, decimal tax, DateTime completedAtUtc) =>
        new(id, LedgerTransactionType.Sale, LedgerReferenceType.SaleRecord, subtotal - discount, tax, completedAtUtc);

    // refundAmount includes VAT; linesNet is the pre-tax value of the returned lines.
    public static SourceTransaction Return(Guid id, decimal refundAmount, decimal linesNet, DateTime createdAtUtc) =>
        new(id, LedgerTransactionType.SaleReturn, LedgerReferenceType.ReturnOrder, -linesNet, -(refundAmount - linesNet), createdAtUtc);
}

internal sealed record LedgerSyncPlan(List<TaxLedgerEntry> ToAdd, List<TaxLedgerEntry> ToRemove);

// Brings the auto-imported part of a period's ledger in line with the POS data, touching only rows that changed.
internal static class TaxLedgerSync
{
    public const decimal StandardRate = 0.15m;

    // Snap to the standard rate when VAT was charged at 15%; anything else keeps its real rate so the anomaly scan can flag it.
    public static decimal ResolveRate(decimal baseAmount, decimal taxAmount)
    {
        if (taxAmount == 0m || baseAmount == 0m)
        {
            return 0m;
        }

        decimal rate = Math.Round(Math.Abs(taxAmount / baseAmount), 4);
        return Math.Abs(rate - StandardRate) <= 0.001m ? StandardRate : rate;
    }

    public static LedgerSyncPlan Plan(
        Guid tenantId,
        Guid periodId,
        IReadOnlyList<SourceTransaction> source,
        IReadOnlyList<TaxLedgerEntry> importedInPeriod,
        IReadOnlySet<Guid> importedInOtherPeriods)
    {
        Dictionary<Guid, TaxLedgerEntry> desired = [];
        foreach (SourceTransaction tx in source)
        {
            if (tx.BaseAmount == 0m && tx.TaxAmount == 0m)
            {
                continue;
            }

            desired[tx.Id] = TaxLedgerEntry.Create(
                tenantId,
                periodId,
                LedgerEntryType.Output,
                tx.TransactionType,
                tx.BaseAmount,
                tx.TaxAmount,
                ResolveRate(tx.BaseAmount, tx.TaxAmount),
                TaxPeriodClock.ToLocalDate(tx.OccurredAtUtc),
                tx.Id,
                tx.ReferenceType);
        }

        List<TaxLedgerEntry> toRemove = [];
        HashSet<Guid> kept = [];
        foreach (TaxLedgerEntry entry in importedInPeriod)
        {
            bool upToDate = entry.ReferenceId is Guid refId &&
                            desired.TryGetValue(refId, out TaxLedgerEntry? wanted) &&
                            SameFigures(entry, wanted) &&
                            kept.Add(refId);
            if (!upToDate)
            {
                toRemove.Add(entry);
            }
        }

        // A transaction already counted in another period (for example one that was filed and closed) is never counted twice.
        List<TaxLedgerEntry> toAdd = desired
            .Where(kv => !kept.Contains(kv.Key) && !importedInOtherPeriods.Contains(kv.Key))
            .Select(kv => kv.Value)
            .ToList();

        return new LedgerSyncPlan(toAdd, toRemove);
    }

    private static bool SameFigures(TaxLedgerEntry a, TaxLedgerEntry b) =>
        a.TransactionType == b.TransactionType &&
        a.BaseAmount == b.BaseAmount &&
        a.TaxAmount == b.TaxAmount &&
        a.TaxRate == b.TaxRate &&
        a.EffectiveDate == b.EffectiveDate;
}
