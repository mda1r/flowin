using FluentAssertions;
using NexusPOS.Tax.Application.Commands.RefreshTaxLedger;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain.Entities;

namespace NexusPOS.Tax.UnitTests.Application;

public sealed class TaxLedgerSyncTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _periodId = Guid.NewGuid();
    private static readonly DateTime _noonUtc = new(2026, 10, 15, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ToUtcRange_UsesRiyadhMidnights()
    {
        (DateTime start, DateTime end) = TaxPeriodClock.ToUtcRange(new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31));

        start.Should().Be(new DateTime(2026, 9, 30, 21, 0, 0, DateTimeKind.Utc));
        end.Should().Be(new DateTime(2026, 10, 31, 21, 0, 0, DateTimeKind.Utc));
        start.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void ToLocalDate_EarlyMorningSaleBelongsToTheLocalDay()
    {
        // 01:30 on 1 October in Riyadh is still 30 September in UTC.
        TaxPeriodClock.ToLocalDate(new DateTime(2026, 9, 30, 22, 30, 0, DateTimeKind.Utc))
            .Should().Be(new DateOnly(2026, 10, 1));
    }

    [Theory]
    [InlineData(100, 15, 0.15)]
    [InlineData(-100, -15, 0.15)]
    [InlineData(33.33, 5, 0.15)]
    [InlineData(100, 0, 0)]
    [InlineData(100, 5, 0.05)]
    public void ResolveRate_SnapsStandardRateAndKeepsOthers(decimal baseAmount, decimal taxAmount, decimal expected)
    {
        TaxLedgerSync.ResolveRate(baseAmount, taxAmount).Should().Be(expected);
    }

    [Fact]
    public void Plan_ImportsSaleNetOfDiscount()
    {
        SourceTransaction sale = SourceTransaction.Sale(Guid.NewGuid(), subtotal: 120m, discount: 20m, tax: 15m, _noonUtc);

        LedgerSyncPlan plan = TaxLedgerSync.Plan(_tenantId, _periodId, [sale], [], new HashSet<Guid>());

        TaxLedgerEntry entry = plan.ToAdd.Should().ContainSingle().Subject;
        entry.BaseAmount.Should().Be(100m);
        entry.TaxAmount.Should().Be(15m);
        entry.TaxRate.Should().Be(0.15m);
        entry.EntryType.Should().Be(LedgerEntryType.Output);
        entry.TransactionType.Should().Be(LedgerTransactionType.Sale);
        entry.ReferenceType.Should().Be(LedgerReferenceType.SaleRecord);
        entry.EffectiveDate.Should().Be(new DateOnly(2026, 10, 15));
    }

    [Fact]
    public void Plan_ImportsZeroRatedSaleWithRateZero()
    {
        SourceTransaction sale = SourceTransaction.Sale(Guid.NewGuid(), 80m, 0m, 0m, _noonUtc);

        LedgerSyncPlan plan = TaxLedgerSync.Plan(_tenantId, _periodId, [sale], [], new HashSet<Guid>());

        TaxLedgerEntry entry = plan.ToAdd.Should().ContainSingle().Subject;
        entry.BaseAmount.Should().Be(80m);
        entry.TaxAmount.Should().Be(0m);
        entry.TaxRate.Should().Be(0m);
    }

    [Fact]
    public void Plan_SkipsEmptySales()
    {
        SourceTransaction sale = SourceTransaction.Sale(Guid.NewGuid(), 50m, 50m, 0m, _noonUtc);

        TaxLedgerSync.Plan(_tenantId, _periodId, [sale], [], new HashSet<Guid>()).ToAdd.Should().BeEmpty();
    }

    [Fact]
    public void Plan_ImportsReturnAsNegativeOutput()
    {
        SourceTransaction refund = SourceTransaction.Return(Guid.NewGuid(), refundAmount: 23m, linesNet: 20m, _noonUtc);

        LedgerSyncPlan plan = TaxLedgerSync.Plan(_tenantId, _periodId, [refund], [], new HashSet<Guid>());

        TaxLedgerEntry entry = plan.ToAdd.Should().ContainSingle().Subject;
        entry.EntryType.Should().Be(LedgerEntryType.Output);
        entry.TransactionType.Should().Be(LedgerTransactionType.SaleReturn);
        entry.ReferenceType.Should().Be(LedgerReferenceType.ReturnOrder);
        entry.BaseAmount.Should().Be(-20m);
        entry.TaxAmount.Should().Be(-3m);
        entry.TaxRate.Should().Be(0.15m);
    }

    [Fact]
    public void Plan_KeepsUpToDateEntries()
    {
        SourceTransaction sale = SourceTransaction.Sale(Guid.NewGuid(), 100m, 0m, 15m, _noonUtc);
        TaxLedgerEntry existing = ImportedEntry(sale.Id, 100m, 15m, new DateOnly(2026, 10, 15));

        LedgerSyncPlan plan = TaxLedgerSync.Plan(_tenantId, _periodId, [sale], [existing], new HashSet<Guid>());

        plan.ToAdd.Should().BeEmpty();
        plan.ToRemove.Should().BeEmpty();
    }

    [Fact]
    public void Plan_ReplacesEntriesWithStaleFigures()
    {
        // Older imports used the pre-discount subtotal as the taxable base.
        SourceTransaction sale = SourceTransaction.Sale(Guid.NewGuid(), 120m, 20m, 15m, _noonUtc);
        TaxLedgerEntry stale = ImportedEntry(sale.Id, 120m, 15m, new DateOnly(2026, 10, 15));

        LedgerSyncPlan plan = TaxLedgerSync.Plan(_tenantId, _periodId, [sale], [stale], new HashSet<Guid>());

        plan.ToRemove.Should().ContainSingle().Which.Should().BeSameAs(stale);
        plan.ToAdd.Should().ContainSingle().Which.BaseAmount.Should().Be(100m);
    }

    [Fact]
    public void Plan_RemovesEntriesOutsideThePeriodWindow()
    {
        TaxLedgerEntry outside = ImportedEntry(Guid.NewGuid(), 100m, 15m, new DateOnly(2026, 9, 30));

        LedgerSyncPlan plan = TaxLedgerSync.Plan(_tenantId, _periodId, [], [outside], new HashSet<Guid>());

        plan.ToRemove.Should().ContainSingle().Which.Should().BeSameAs(outside);
        plan.ToAdd.Should().BeEmpty();
    }

    [Fact]
    public void Plan_DoesNotCountTransactionsAlreadyInAnotherPeriod()
    {
        SourceTransaction sale = SourceTransaction.Sale(Guid.NewGuid(), 100m, 0m, 15m, _noonUtc);

        LedgerSyncPlan plan = TaxLedgerSync.Plan(_tenantId, _periodId, [sale], [], new HashSet<Guid> { sale.Id });

        plan.ToAdd.Should().BeEmpty();
    }

    [Fact]
    public void Plan_RemovesDuplicateImportsOfTheSameTransaction()
    {
        SourceTransaction sale = SourceTransaction.Sale(Guid.NewGuid(), 100m, 0m, 15m, _noonUtc);
        TaxLedgerEntry first = ImportedEntry(sale.Id, 100m, 15m, new DateOnly(2026, 10, 15));
        TaxLedgerEntry second = ImportedEntry(sale.Id, 100m, 15m, new DateOnly(2026, 10, 15));

        LedgerSyncPlan plan = TaxLedgerSync.Plan(_tenantId, _periodId, [sale], [first, second], new HashSet<Guid>());

        plan.ToRemove.Should().ContainSingle().Which.Should().BeSameAs(second);
        plan.ToAdd.Should().BeEmpty();
    }

    private static TaxLedgerEntry ImportedEntry(Guid referenceId, decimal baseAmount, decimal taxAmount, DateOnly date) =>
        TaxLedgerEntry.Create(
            _tenantId, _periodId, LedgerEntryType.Output, LedgerTransactionType.Sale,
            baseAmount, taxAmount, 0.15m, date, referenceId, LedgerReferenceType.SaleRecord);
}
