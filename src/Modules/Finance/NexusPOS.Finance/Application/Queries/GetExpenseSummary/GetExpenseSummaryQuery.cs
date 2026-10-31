using NexusPOS.Finance.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Finance.Application.Queries.GetExpenseSummary;

public sealed record GetExpenseSummaryQuery(Guid BranchId, DateOnly DateFrom, DateOnly DateTo)
    : IQuery<ExpenseSummaryResponse>;
