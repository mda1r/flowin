using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.AddPurchaseOrderLine;

public sealed record AddPurchaseOrderLineCommand(
    Guid PurchaseOrderId,
    Guid BranchId,
    Guid VariantId,
    string Description,
    decimal UnitCost,
    decimal Quantity) : ICommand<PurchaseOrderResponse>;
