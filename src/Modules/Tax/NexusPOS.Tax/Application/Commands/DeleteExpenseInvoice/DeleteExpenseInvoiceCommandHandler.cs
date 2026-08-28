using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
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
            return Error.NotFound("TaxExpenseInvoice.NotFound", "Expense invoice not found.");
        }

        db.TaxExpenseInvoices.Remove(invoice);

        // Remove the associated ledger entry
        TaxLedgerEntry? ledgerEntry = await db.TaxLedgerEntries
            .FirstOrDefaultAsync(
                e => e.ReferenceId == request.InvoiceId &&
                     e.ReferenceType == "TaxExpenseInvoice" &&
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
