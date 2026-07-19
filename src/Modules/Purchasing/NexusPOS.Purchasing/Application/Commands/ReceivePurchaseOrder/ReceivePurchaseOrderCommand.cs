using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.ReceivePurchaseOrder;

public sealed record ReceivePurchaseOrderCommand(Guid PurchaseOrderId, Guid BranchId) : ICommand<PurchaseOrderResponse>;
