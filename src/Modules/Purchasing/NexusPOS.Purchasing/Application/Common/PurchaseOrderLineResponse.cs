namespace NexusPOS.Purchasing.Application.Common;

public sealed record PurchaseOrderLineResponse(
    Guid Id,
    Guid VariantId,
    string Description,
    decimal UnitCost,
    decimal OrderedQuantity,
    decimal ReceivedQuantity,
    decimal LineTotal,
    bool IsFullyReceived);
