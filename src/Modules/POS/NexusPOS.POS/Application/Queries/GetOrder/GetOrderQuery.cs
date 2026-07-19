using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.GetOrder;

public sealed record GetOrderQuery(Guid OrderId, Guid BranchId) : IQuery<OrderResponse>;
