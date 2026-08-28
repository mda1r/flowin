using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Queries.GetTaxLedger;

internal sealed class GetTaxLedgerQueryHandler(TaxConfigDbContext db)
    : IQueryHandler<GetTaxLedgerQuery, TaxLedgerResult>
{
    public async Task<ErrorOr<TaxLedgerResult>> Handle(
        GetTaxLedgerQuery request,
        CancellationToken cancellationToken)
    {
        var query = db.TaxLedgerEntries
            .AsNoTracking()
            .Where(e => e.TenantId == request.TenantId && e.PeriodId == request.PeriodId);

        int total = await query.CountAsync(cancellationToken);

        List<TaxLedgerEntryResponse> items = await query
            .OrderByDescending(e => e.EffectiveDate)
            .ThenByDescending(e => e.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(e => new TaxLedgerEntryResponse(
                e.Id, e.EntryType, e.TransactionType, e.ReferenceId, e.ReferenceType,
                e.BaseAmount, e.TaxAmount, e.TaxRate, e.EffectiveDate, e.CreatedAt))
            .ToListAsync(cancellationToken);

        return new TaxLedgerResult(items, total, request.Page, request.PageSize);
    }
}
