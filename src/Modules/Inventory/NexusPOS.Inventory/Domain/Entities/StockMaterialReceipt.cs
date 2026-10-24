namespace NexusPOS.Inventory.Domain.Entities;

// Marks a purchase order whose raw-material lines were applied; saved with the material updates
// so an order is applied at most once even if the receipt event is retried.
public sealed class StockMaterialReceipt
{
    public Guid PurchaseOrderId { get; private set; }
    public Guid TenantId { get; private set; }
    public int LineCount { get; private set; }
    public DateTime AppliedAt { get; private set; }

    private StockMaterialReceipt() { }

    public static StockMaterialReceipt Create(Guid tenantId, Guid purchaseOrderId, int lineCount) => new()
    {
        PurchaseOrderId = purchaseOrderId,
        TenantId = tenantId,
        LineCount = lineCount,
        AppliedAt = DateTime.UtcNow,
    };
}
