using ErrorOr;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.RecordExpenseInvoice;

internal sealed class RecordExpenseInvoiceCommandHandler(TaxConfigDbContext db)
    : ICommandHandler<RecordExpenseInvoiceCommand, TaxExpenseInvoiceResponse>
{
    public async Task<ErrorOr<TaxExpenseInvoiceResponse>> Handle(
        RecordExpenseInvoiceCommand request,
        CancellationToken cancellationToken)
    {
        TaxExpenseInvoice invoice = TaxExpenseInvoice.Create(
            request.TenantId,
            request.PeriodId,
            request.SupplierName,
            request.SupplierVatNumber,
            request.InvoiceNumber,
            request.InvoiceDate,
            request.BaseAmount,
            request.TaxAmount,
            request.TaxRate,
            request.Currency,
            request.Notes);

        db.TaxExpenseInvoices.Add(invoice);

        // Also create a ledger entry for this input VAT
        TaxLedgerEntry ledgerEntry = TaxLedgerEntry.Create(
            request.TenantId,
            request.PeriodId,
            LedgerEntryType.Input,
            LedgerTransactionType.PurchaseInvoice,
            request.BaseAmount,
            request.TaxAmount,
            request.TaxRate,
            request.InvoiceDate,
            invoice.Id,
            "TaxExpenseInvoice");

        db.TaxLedgerEntries.Add(ledgerEntry);
        await db.SaveChangesAsync(cancellationToken);

        return new TaxExpenseInvoiceResponse(
            invoice.Id, invoice.PeriodId, invoice.SupplierName, invoice.SupplierVatNumber,
            invoice.InvoiceNumber, invoice.InvoiceDate, invoice.BaseAmount, invoice.TaxAmount,
            invoice.TaxRate, invoice.Currency, invoice.Notes, invoice.CreatedAt);
    }
}
