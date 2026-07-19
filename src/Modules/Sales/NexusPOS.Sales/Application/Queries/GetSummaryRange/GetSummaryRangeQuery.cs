using NexusPOS.Sales.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Queries.GetSummaryRange;

public sealed record GetSummaryRangeQuery(Guid BranchId, DateOnly DateFrom, DateOnly DateTo)
    : IQuery<IReadOnlyList<SalesSummaryResponse>>;
