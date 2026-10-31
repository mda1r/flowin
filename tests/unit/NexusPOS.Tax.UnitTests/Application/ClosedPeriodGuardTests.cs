using ErrorOr;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NexusPOS.Tax.Application.Commands.DeleteExpenseInvoice;
using NexusPOS.Tax.Application.Commands.RecordExpenseInvoice;
using NexusPOS.Tax.Application.Commands.RefreshTaxLedger;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Application.Queries.GetVatReturnData;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.UnitTests.Application;

public sealed class ClosedPeriodGuardTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();

    [Fact]
    public async Task RecordExpense_IntoClosedPeriod_ReturnsConflict()
    {
        await using TaxConfigDbContext db = CreateDb();
        TaxPeriod period = AddPeriod(db, _tenantId, closed: true);
        await db.SaveChangesAsync();

        ErrorOr<TaxExpenseInvoiceResponse> result =
            await new RecordExpenseInvoiceCommandHandler(db).Handle(Expense(period.Id), CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.Conflict);
        (await db.TaxExpenseInvoices.CountAsync()).Should().Be(0);
        (await db.TaxLedgerEntries.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task RecordExpense_IntoAnotherTenantsPeriod_ReturnsNotFound()
    {
        await using TaxConfigDbContext db = CreateDb();
        TaxPeriod foreign = AddPeriod(db, Guid.NewGuid(), closed: false);
        await db.SaveChangesAsync();

        ErrorOr<TaxExpenseInvoiceResponse> result =
            await new RecordExpenseInvoiceCommandHandler(db).Handle(Expense(foreign.Id), CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
        (await db.TaxExpenseInvoices.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task RecordExpense_IntoOpenPeriod_AddsInvoiceAndInputVat()
    {
        await using TaxConfigDbContext db = CreateDb();
        TaxPeriod period = AddPeriod(db, _tenantId, closed: false);
        await db.SaveChangesAsync();

        ErrorOr<TaxExpenseInvoiceResponse> result =
            await new RecordExpenseInvoiceCommandHandler(db).Handle(Expense(period.Id), CancellationToken.None);

        result.IsError.Should().BeFalse();
        TaxLedgerEntry entry = (await db.TaxLedgerEntries.ToListAsync()).Should().ContainSingle().Subject;
        entry.EntryType.Should().Be(LedgerEntryType.Input);
        entry.ReferenceType.Should().Be(LedgerReferenceType.ExpenseInvoice);
    }

    [Fact]
    public async Task DeleteExpense_FromClosedPeriod_ReturnsConflictAndKeepsInputVat()
    {
        await using TaxConfigDbContext db = CreateDb();
        TaxPeriod period = AddPeriod(db, _tenantId, closed: false);
        await db.SaveChangesAsync();
        ErrorOr<TaxExpenseInvoiceResponse> recorded =
            await new RecordExpenseInvoiceCommandHandler(db).Handle(Expense(period.Id), CancellationToken.None);
        period.Close();
        await db.SaveChangesAsync();

        ErrorOr<bool> result = await new DeleteExpenseInvoiceCommandHandler(db)
            .Handle(new DeleteExpenseInvoiceCommand(recorded.Value.Id, _tenantId), CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.Conflict);
        (await db.TaxExpenseInvoices.CountAsync()).Should().Be(1);
        (await db.TaxLedgerEntries.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task DeleteExpense_FromOpenPeriod_RemovesInvoiceAndInputVat()
    {
        await using TaxConfigDbContext db = CreateDb();
        TaxPeriod period = AddPeriod(db, _tenantId, closed: false);
        await db.SaveChangesAsync();
        ErrorOr<TaxExpenseInvoiceResponse> recorded =
            await new RecordExpenseInvoiceCommandHandler(db).Handle(Expense(period.Id), CancellationToken.None);

        ErrorOr<bool> result = await new DeleteExpenseInvoiceCommandHandler(db)
            .Handle(new DeleteExpenseInvoiceCommand(recorded.Value.Id, _tenantId), CancellationToken.None);

        result.IsError.Should().BeFalse();
        (await db.TaxExpenseInvoices.CountAsync()).Should().Be(0);
        (await db.TaxLedgerEntries.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task RefreshLedger_ForClosedPeriod_ReturnsConflict()
    {
        await using TaxConfigDbContext db = CreateDb();
        TaxPeriod period = AddPeriod(db, _tenantId, closed: true);
        await db.SaveChangesAsync();

        RefreshTaxLedgerCommandHandler handler = new(db, NullLogger<RefreshTaxLedgerCommandHandler>.Instance);
        ErrorOr<int> result = await handler.Handle(new RefreshTaxLedgerCommand(period.Id, _tenantId), CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.Conflict);
    }

    [Fact]
    public async Task VatReturn_NetsRefundsAndReportsZeroRatedSales()
    {
        await using TaxConfigDbContext db = CreateDb();
        TaxPeriod period = AddPeriod(db, _tenantId, closed: false);
        DateOnly day = new(2026, 10, 10);
        db.TaxLedgerEntries.AddRange(
            Output(period.Id, LedgerTransactionType.Sale, 1000m, 150m, 0.15m, day),
            Output(period.Id, LedgerTransactionType.SaleReturn, -200m, -30m, 0.15m, day),
            Output(period.Id, LedgerTransactionType.Sale, 300m, 0m, 0m, day),
            TaxLedgerEntry.Create(_tenantId, period.Id, LedgerEntryType.Input, LedgerTransactionType.PurchaseInvoice,
                400m, 60m, 0.15m, day, Guid.NewGuid(), LedgerReferenceType.ExpenseInvoice));
        await db.SaveChangesAsync();

        ErrorOr<VatReturnResponse> result = await new GetVatReturnDataQueryHandler(db)
            .Handle(new GetVatReturnDataQuery(period.Id, _tenantId), CancellationToken.None);

        VatReturnResponse vat = result.Value;
        vat.Box1StandardRatedSales.Should().Be(800m);
        vat.Box1OutputVat.Should().Be(120m);
        vat.Box2ZeroRatedSales.Should().Be(300m);
        vat.Box6InputVat.Should().Be(60m);
        vat.Box11NetVatDue.Should().Be(60m);
    }

    private static TaxConfigDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TaxConfigDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static TaxPeriod AddPeriod(TaxConfigDbContext db, Guid tenantId, bool closed)
    {
        TaxPeriod period = TaxPeriod.Create(tenantId, new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31));
        if (closed)
        {
            period.Close();
        }

        db.TaxPeriods.Add(period);
        return period;
    }

    private static RecordExpenseInvoiceCommand Expense(Guid periodId) =>
        new(_tenantId, periodId, "مورد", "300000000000003", "INV-1", new DateOnly(2026, 10, 5),
            100m, 15m, 0.15m, "SAR", null);

    private static TaxLedgerEntry Output(Guid periodId, string type, decimal baseAmount, decimal tax, decimal rate, DateOnly day) =>
        TaxLedgerEntry.Create(_tenantId, periodId, LedgerEntryType.Output, type, baseAmount, tax, rate, day,
            Guid.NewGuid(), type == LedgerTransactionType.Sale ? LedgerReferenceType.SaleRecord : LedgerReferenceType.ReturnOrder);
}
