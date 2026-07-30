using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Inventory.Domain.Entities;

public sealed class StockCountItem : Entity<StockCountItemId>
{
    public StockCountSessionId SessionId { get; private set; } = null!;
    public Guid StockItemId { get; private set; }
    public Guid VariantId { get; private set; }
    public decimal SystemQuantity { get; private set; }
    public decimal? CountedQuantity { get; private set; }
    public decimal UnitCost { get; private set; }

    public decimal Difference => CountedQuantity.HasValue ? CountedQuantity.Value - SystemQuantity : 0;
    public decimal SystemValue => SystemQuantity * UnitCost;
    public decimal CountedValue => (CountedQuantity ?? SystemQuantity) * UnitCost;
    public decimal TaxAmount => CountedValue * 0.15m;
    public bool HasDiscrepancy => CountedQuantity.HasValue && CountedQuantity.Value != SystemQuantity;

    private StockCountItem() { }

    public static StockCountItem Create(
        StockCountSessionId sessionId,
        Guid stockItemId,
        Guid variantId,
        decimal systemQuantity,
        decimal unitCost) =>
        new()
        {
            Id = new StockCountItemId(Guid.NewGuid()),
            SessionId = sessionId,
            StockItemId = stockItemId,
            VariantId = variantId,
            SystemQuantity = systemQuantity,
            UnitCost = unitCost >= 0 ? unitCost : 0,
        };

    public void UpdateCount(decimal countedQuantity)
    {
        CountedQuantity = countedQuantity >= 0 ? countedQuantity : 0;
    }
}
