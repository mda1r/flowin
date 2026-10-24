using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Purchasing.Domain.Entities;

public sealed class PurchaseOrderLine : Entity<PurchaseOrderLineId>
{
    // A line is either a sellable product variant or a raw stock material; for material lines VariantId is Guid.Empty.
    public Guid VariantId { get; private set; }
    public Guid? StockMaterialId { get; private set; }
    public bool IsMaterial => StockMaterialId.HasValue;
    public string Description { get; private set; } = string.Empty;
    public decimal UnitCost { get; private set; }
    public decimal OrderedQuantity { get; private set; }
    public decimal ReceivedQuantity { get; private set; }
    public decimal LineTotal => UnitCost * OrderedQuantity;
    public bool IsFullyReceived => ReceivedQuantity >= OrderedQuantity;

    private PurchaseOrderLine() { }

    internal static PurchaseOrderLine Create(Guid variantId, string description, decimal unitCost, decimal orderedQuantity)
        => Create(variantId, null, description, unitCost, orderedQuantity);

    internal static PurchaseOrderLine CreateForMaterial(Guid stockMaterialId, string description, decimal unitCost, decimal orderedQuantity)
        => Create(Guid.Empty, stockMaterialId, description, unitCost, orderedQuantity);

    private static PurchaseOrderLine Create(Guid variantId, Guid? stockMaterialId, string description, decimal unitCost, decimal orderedQuantity)
    {
        return new PurchaseOrderLine
        {
            Id = new PurchaseOrderLineId(Guid.NewGuid()),
            VariantId = variantId,
            StockMaterialId = stockMaterialId,
            Description = description.Trim(),
            UnitCost = unitCost,
            OrderedQuantity = orderedQuantity,
            ReceivedQuantity = 0,
        };
    }

    internal void Receive(decimal quantity)
    {
        ReceivedQuantity = Math.Min(ReceivedQuantity + quantity, OrderedQuantity);
    }

    internal void ReceiveAll()
    {
        ReceivedQuantity = OrderedQuantity;
    }
}
