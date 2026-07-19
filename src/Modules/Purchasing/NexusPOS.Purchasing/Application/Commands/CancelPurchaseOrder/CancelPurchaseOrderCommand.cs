using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.CancelPurchaseOrder;

public sealed record CancelPurchaseOrderCommand(
    Guid PurchaseOrderId,
    Guid BranchId,
    string? Reason = null) : ICommand<PurchaseOrderResponse>;
