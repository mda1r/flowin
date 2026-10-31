using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain;
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
        if (request.PeriodId is Guid periodId)
        {
            // The period id comes from the request body, so it must belong to the caller's tenant and still be open.
            string? status = await db.TaxPeriods
                .Where(p => p.Id == periodId && p.TenantId == request.TenantId)
                .Select(p => p.Status)
                .FirstOrDefaultAsync(cancellationToken);

            if (status is null)
            {
                return TaxErrors.PeriodNotFound;
            }

            if (status == TaxPeriodStatus.Closed)
            {
                return TaxErrors.PeriodClosed;
            }
        }

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
            LedgerReferenceType.ExpenseInvoice);

        db.TaxLedgerEntries.Add(ledgerEntry);
        await db.SaveChangesAsync(cancellationToken);

        return new TaxExpenseInvoiceResponse(
            invoice.Id, invoice.PeriodId, invoice.SupplierName, invoice.SupplierVatNumber,
            invoice.InvoiceNumber, invoice.InvoiceDate, invoice.BaseAmount, invoice.TaxAmount,
            invoice.TaxRate, invoice.Currency, invoice.Notes, invoice.CreatedAt);
    }
}
