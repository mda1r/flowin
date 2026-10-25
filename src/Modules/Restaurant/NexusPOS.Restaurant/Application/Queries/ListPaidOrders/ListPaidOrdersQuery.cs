using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListPaidOrders;

public sealed record ListPaidOrdersQuery(Guid BranchId, DateTime From, DateTime To) : IQuery<IReadOnlyList<RestaurantOrderResponse>>;
