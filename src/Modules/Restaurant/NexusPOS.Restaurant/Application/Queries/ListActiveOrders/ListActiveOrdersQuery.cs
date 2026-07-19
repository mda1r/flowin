using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListActiveOrders;

public sealed record ListActiveOrdersQuery(Guid BranchId) : IQuery<IReadOnlyList<RestaurantOrderResponse>>;
