using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.RetryInventoryReceipt;

public sealed record RetryInventoryReceiptCommand(Guid PurchaseOrderId, Guid BranchId) : ICommand<PurchaseOrderResponse>;
