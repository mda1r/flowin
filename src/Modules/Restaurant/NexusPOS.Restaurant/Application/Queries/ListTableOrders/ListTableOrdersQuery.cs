using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListTableOrders;

public sealed record ListTableOrdersQuery(
    Guid BranchId,
    int TableNumber) : IQuery<IReadOnlyList<RestaurantOrderResponse>>;
