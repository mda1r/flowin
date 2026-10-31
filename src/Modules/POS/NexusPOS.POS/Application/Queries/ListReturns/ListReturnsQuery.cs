using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListReturns;

// Newest first, capped at Limit so a branch's whole return history is never loaded in one go.
public sealed record ListReturnsQuery(Guid BranchId, DateTime? From = null, DateTime? To = null, int Limit = ListReturnsQuery.DefaultLimit)
    : IQuery<IReadOnlyList<ReturnOrderResponse>>
{
    public const int DefaultLimit = 1000;
    public const int MaxLimit = 2000;
}
