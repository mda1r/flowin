using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Queries.ListExpenseInvoices;

internal sealed class ListExpenseInvoicesQueryHandler(TaxConfigDbContext db)
    : IQueryHandler<ListExpenseInvoicesQuery, List<TaxExpenseInvoiceResponse>>
{
    public async Task<ErrorOr<List<TaxExpenseInvoiceResponse>>> Handle(
        ListExpenseInvoicesQuery request,
        CancellationToken cancellationToken)
    {
        var query = db.TaxExpenseInvoices
            .AsNoTracking()
            .Where(e => e.TenantId == request.TenantId);

        if (request.PeriodId.HasValue)
        {
            query = query.Where(e => e.PeriodId == request.PeriodId.Value);
        }

        List<TaxExpenseInvoiceResponse> items = await query
            .OrderByDescending(e => e.InvoiceDate)
            .Select(e => new TaxExpenseInvoiceResponse(
                e.Id, e.PeriodId, e.SupplierName, e.SupplierVatNumber,
                e.InvoiceNumber, e.InvoiceDate, e.BaseAmount, e.TaxAmount,
                e.TaxRate, e.Currency, e.Notes, e.CreatedAt))
            .ToListAsync(cancellationToken);

        return items;
    }
}
