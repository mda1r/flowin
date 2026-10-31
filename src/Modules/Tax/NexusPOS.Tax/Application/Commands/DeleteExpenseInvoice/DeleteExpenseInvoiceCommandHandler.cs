using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Domain;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.DeleteExpenseInvoice;

internal sealed class DeleteExpenseInvoiceCommandHandler(TaxConfigDbContext db)
    : ICommandHandler<DeleteExpenseInvoiceCommand, bool>
{
    public async Task<ErrorOr<bool>> Handle(
        DeleteExpenseInvoiceCommand request,
        CancellationToken cancellationToken)
    {
        TaxExpenseInvoice? invoice = await db.TaxExpenseInvoices
            .FirstOrDefaultAsync(
                e => e.Id == request.InvoiceId && e.TenantId == request.TenantId,
                cancellationToken);

        if (invoice is null)
        {
            return Error.NotFound("TaxExpenseInvoice.NotFound", "فاتورة المصروف غير موجودة");
        }

        // Removing a purchase invoice changes the input VAT of its period, which is not allowed once filed.
        if (invoice.PeriodId is Guid periodId &&
            await db.TaxPeriods.AnyAsync(
                p => p.Id == periodId && p.TenantId == request.TenantId && p.Status == TaxPeriodStatus.Closed,
                cancellationToken))
        {
            return TaxErrors.PeriodClosed;
        }

        db.TaxExpenseInvoices.Remove(invoice);

        // Remove the associated ledger entry
        TaxLedgerEntry? ledgerEntry = await db.TaxLedgerEntries
            .FirstOrDefaultAsync(
                e => e.ReferenceId == request.InvoiceId &&
                     e.ReferenceType == LedgerReferenceType.ExpenseInvoice &&
                     e.TenantId == request.TenantId,
                cancellationToken);

        if (ledgerEntry is not null)
        {
            db.TaxLedgerEntries.Remove(ledgerEntry);
        }

        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
