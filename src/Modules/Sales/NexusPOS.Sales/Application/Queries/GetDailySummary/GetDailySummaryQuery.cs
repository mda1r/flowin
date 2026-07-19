using NexusPOS.Sales.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Queries.GetDailySummary;

public sealed record GetDailySummaryQuery(Guid BranchId, DateOnly Date) : IQuery<SalesSummaryResponse>;
