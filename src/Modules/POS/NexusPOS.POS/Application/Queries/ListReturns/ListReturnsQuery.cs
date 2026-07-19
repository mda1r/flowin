using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListReturns;

public sealed record ListReturnsQuery(Guid BranchId) : IQuery<IReadOnlyList<ReturnOrderResponse>>;
