using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListReturns;

// DateFrom is inclusive and DateTo exclusive (UTC instants); either may be omitted.
public sealed record ListReturnsQuery(Guid BranchId, DateTime? DateFrom = null, DateTime? DateTo = null)
    : IQuery<IReadOnlyList<ReturnOrderResponse>>;
