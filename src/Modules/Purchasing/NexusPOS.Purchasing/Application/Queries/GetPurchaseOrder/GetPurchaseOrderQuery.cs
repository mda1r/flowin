using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Queries.GetPurchaseOrder;

public sealed record GetPurchaseOrderQuery(Guid PurchaseOrderId, Guid BranchId) : IQuery<PurchaseOrderResponse>;
