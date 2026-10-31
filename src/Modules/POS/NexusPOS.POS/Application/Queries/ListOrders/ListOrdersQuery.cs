using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListOrders;

public sealed record ListOrdersQuery(
    Guid BranchId,
    OrderStatus? Status = null,
    DateTime? From = null,
    DateTime? To = null,
    int Page = 1,
    int PageSize = 50) : IQuery<IReadOnlyList<OrderResponse>>;
