using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.RemovePurchaseOrderLine;

public sealed record RemovePurchaseOrderLineCommand(
    Guid PurchaseOrderId,
    Guid BranchId,
    Guid LineId) : ICommand<PurchaseOrderResponse>;
