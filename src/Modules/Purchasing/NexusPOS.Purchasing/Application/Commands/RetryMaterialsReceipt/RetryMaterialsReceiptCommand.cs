using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.RetryMaterialsReceipt;

public sealed record RetryMaterialsReceiptCommand(Guid PurchaseOrderId, Guid BranchId) : ICommand<PurchaseOrderResponse>;
