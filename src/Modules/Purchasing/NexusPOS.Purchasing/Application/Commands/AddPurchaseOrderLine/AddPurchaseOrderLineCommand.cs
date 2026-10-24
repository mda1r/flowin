using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.AddPurchaseOrderLine;

// Exactly one of VariantId (sellable product) or StockMaterialId (raw material) is set.
public sealed record AddPurchaseOrderLineCommand(
    Guid PurchaseOrderId,
    Guid BranchId,
    Guid? VariantId,
    string Description,
    decimal UnitCost,
    decimal Quantity,
    Guid? StockMaterialId = null) : ICommand<PurchaseOrderResponse>;
