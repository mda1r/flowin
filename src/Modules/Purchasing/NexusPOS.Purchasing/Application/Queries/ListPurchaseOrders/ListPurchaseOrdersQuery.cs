using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Queries.ListPurchaseOrders;

public sealed record ListPurchaseOrdersQuery(
    Guid BranchId,
    PurchaseOrderStatus? Status = null,
    Guid? SupplierId = null,
    int Page = 1,
    int PageSize = 20) : IQuery<IReadOnlyList<PurchaseOrderResponse>>;
