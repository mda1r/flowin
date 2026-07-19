using ErrorOr;
using NexusPOS.Sales.Application.Common;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Queries.GetSummaryRange;

internal sealed class GetSummaryRangeQueryHandler(ISalesSummaryRepository salesSummaryRepository)
    : IQueryHandler<GetSummaryRangeQuery, IReadOnlyList<SalesSummaryResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<SalesSummaryResponse>>> Handle(
        GetSummaryRangeQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<SalesSummary> summaries = await salesSummaryRepository.FindByBranchAndRangeAsync(
            request.BranchId, request.DateFrom, request.DateTo, cancellationToken);

        return summaries.Select(s => new SalesSummaryResponse(
            s.BranchId,
            s.SummaryDate,
            s.Currency,
            s.TotalOrders,
            s.TotalRevenue,
            s.TotalDiscounts,
            s.TotalTax,
            s.AverageOrderValue)).ToList();
    }
}
