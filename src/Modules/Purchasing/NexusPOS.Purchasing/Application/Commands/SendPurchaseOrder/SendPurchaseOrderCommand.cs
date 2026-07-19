using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.SendPurchaseOrder;

public sealed record SendPurchaseOrderCommand(Guid PurchaseOrderId, Guid BranchId) : ICommand<PurchaseOrderResponse>;
