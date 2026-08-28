using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Queries.ListTaxPeriods;

internal sealed class ListTaxPeriodsQueryHandler(TaxConfigDbContext db)
    : IQueryHandler<ListTaxPeriodsQuery, List<TaxPeriodResponse>>
{
    public async Task<ErrorOr<List<TaxPeriodResponse>>> Handle(
        ListTaxPeriodsQuery request,
        CancellationToken cancellationToken)
    {
        List<TaxPeriodResponse> periods = await db.TaxPeriods
            .AsNoTracking()
            .Where(p => p.TenantId == request.TenantId)
            .OrderByDescending(p => p.StartDate)
            .Select(p => new TaxPeriodResponse(
                p.Id, p.StartDate, p.EndDate, p.Status, p.Notes, p.CreatedAt, p.ClosedAt))
            .ToListAsync(cancellationToken);

        return periods;
    }
}
