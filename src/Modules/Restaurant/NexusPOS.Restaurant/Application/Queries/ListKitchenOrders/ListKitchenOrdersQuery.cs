using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListKitchenOrders;

public sealed record ListKitchenOrdersQuery(Guid BranchId) : IQuery<IReadOnlyList<RestaurantOrderResponse>>;
