using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Queries.GetTaxAnomalies;

internal sealed class GetTaxAnomaliesQueryHandler(TaxConfigDbContext db)
    : IQueryHandler<GetTaxAnomaliesQuery, List<TaxAnomalyResponse>>
{
    public async Task<ErrorOr<List<TaxAnomalyResponse>>> Handle(
        GetTaxAnomaliesQuery request,
        CancellationToken cancellationToken)
    {
        var query = db.TaxAnomalies
            .AsNoTracking()
            .Where(a => a.TenantId == request.TenantId && a.PeriodId == request.PeriodId);

        if (!request.IncludeResolved)
        {
            query = query.Where(a => !a.IsResolved);
        }

        List<TaxAnomalyResponse> anomalies = await query
            .OrderBy(a => a.Severity == "error" ? 0 : a.Severity == "warning" ? 1 : 2)
            .ThenByDescending(a => a.DetectedAt)
            .Select(a => new TaxAnomalyResponse(
                a.Id, a.RuleCode, a.Severity, a.Title, a.Description,
                a.TransactionRef, a.DetectedAt, a.IsResolved, a.ResolvedAt))
            .ToListAsync(cancellationToken);

        return anomalies;
    }
}
