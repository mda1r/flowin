using ErrorOr;
using NexusPOS.Sales.Application.Common;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Queries.GetDailySummary;

internal sealed class GetDailySummaryQueryHandler(ISalesSummaryRepository salesSummaryRepository)
    : IQueryHandler<GetDailySummaryQuery, SalesSummaryResponse>
{
    public async Task<ErrorOr<SalesSummaryResponse>> Handle(
        GetDailySummaryQuery request,
        CancellationToken cancellationToken)
    {
        SalesSummary? summary = await salesSummaryRepository.FindByBranchAndDateAsync(
            request.BranchId, request.Date, cancellationToken);

        if (summary is null)
        {
            return new SalesSummaryResponse(
                request.BranchId, request.Date, "USD", 0, 0m, 0m, 0m, 0m);
        }

        return new SalesSummaryResponse(
            summary.BranchId,
            summary.SummaryDate,
            summary.Currency,
            summary.TotalOrders,
            summary.TotalRevenue,
            summary.TotalDiscounts,
            summary.TotalTax,
            summary.AverageOrderValue);
    }
}
