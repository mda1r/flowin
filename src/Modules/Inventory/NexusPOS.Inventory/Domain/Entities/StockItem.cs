using ErrorOr;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Events;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Inventory.Domain.Entities;

public sealed class StockItem : AggregateRoot<StockItemId>
{
    public Guid VariantId { get; private set; }
    public Guid BranchId { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal ReorderPoint { get; private set; }
    public decimal ReorderQuantity { get; private set; }
    public DateTime? ExpiryDate { get; private set; }
    public int NotifyDaysBeforeExpiry { get; private set; } = 7;

    // Archived items keep their movement history but are no longer tracked, listed or alerted on.
    public bool IsArchived { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public List<StockMovement> Movements { get; private set; } = [];

    private StockItem() { }

    public static StockItem Create(Guid variantId, Guid branchId, decimal reorderPoint = 0, decimal reorderQuantity = 0)
    {
        return new StockItem
        {
            Id = new StockItemId(Guid.NewGuid()),
            VariantId = variantId,
            BranchId = branchId,
            Quantity = 0,
            ReorderPoint = reorderPoint,
            ReorderQuantity = reorderQuantity,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void SetExpiryDate(DateTime? expiryDate)
    {
        ExpiryDate = expiryDate;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetNotifyDaysBeforeExpiry(int days)
    {
        NotifyDaysBeforeExpiry = days < 1 ? 1 : days;
        UpdatedAt = DateTime.UtcNow;
    }

    public ErrorOr<Success> Receive(
        decimal quantity,
        string? reference = null,
        string? notes = null,
        DateTime? expiryDate = null,
        Guid? userId = null,
        MovementType type = MovementType.Receive)
    {
        if (quantity <= 0)
        {
            return InventoryErrors.InvalidQuantity;
        }

        decimal before = Quantity;
        Quantity += quantity;
        if (expiryDate.HasValue)
        {
            ExpiryDate = expiryDate;
        }
        // Receiving new stock means the item is tracked again.
        IsArchived = false;
        UpdatedAt = DateTime.UtcNow;

        Movements.Add(StockMovement.Record(Id, type, quantity, before, Quantity, reference, notes, userId));
        RaiseDomainEvent(new StockLevelChangedDomainEvent(Id.Value, VariantId, BranchId, before, Quantity));

        return Result.Success;
    }

    public ErrorOr<Success> Deduct(
        decimal quantity,
        MovementType type,
        string? reference = null,
        string? notes = null,
        Guid? userId = null)
    {
        if (quantity <= 0)
        {
            return InventoryErrors.InvalidQuantity;
        }

        if (Quantity < quantity)
        {
            return InventoryErrors.InsufficientStock;
        }

        RecordDeduction(quantity, Quantity - quantity, type, reference, notes, userId);
        return Result.Success;
    }

    // A completed sale has already happened, so it is always recorded. When it needs more than the recorded
    // quantity (stale till, two tills, an uncounted delivery) stock goes to zero and the shortfall is returned.
    public ErrorOr<decimal> DeductForSale(
        decimal quantity,
        string? reference = null,
        string? notes = null,
        Guid? userId = null)
    {
        if (quantity <= 0)
        {
            return InventoryErrors.InvalidQuantity;
        }

        decimal shortfall = Math.Max(quantity - Math.Max(Quantity, 0m), 0m);
        if (shortfall > 0)
        {
            string shortfallNote = $"نقص {shortfall:0.####} عن المخزون المسجّل";
            notes = string.IsNullOrWhiteSpace(notes) ? shortfallNote : $"{notes} · {shortfallNote}";
        }

        RecordDeduction(quantity, Math.Max(Quantity - quantity, 0m), MovementType.Sale, reference, notes, userId);
        return shortfall;
    }

    private void RecordDeduction(
        decimal quantity, decimal newQuantity, MovementType type, string? reference, string? notes, Guid? userId)
    {
        decimal before = Quantity;
        Quantity = newQuantity;
        UpdatedAt = DateTime.UtcNow;

        Movements.Add(StockMovement.Record(Id, type, quantity, before, Quantity, reference, notes, userId));
        RaiseDomainEvent(new StockLevelChangedDomainEvent(Id.Value, VariantId, BranchId, before, Quantity));

        if (Quantity <= ReorderPoint && ReorderPoint > 0)
        {
            RaiseDomainEvent(new LowStockAlertDomainEvent(Id.Value, VariantId, BranchId, Quantity, ReorderPoint));
        }
    }

    public ErrorOr<Success> Adjust(decimal newQuantity, string? reference = null, string? notes = null, Guid? userId = null)
    {
        if (newQuantity < 0)
        {
            return InventoryErrors.InvalidQuantity;
        }

        decimal before = Quantity;
        Quantity = newQuantity;
        UpdatedAt = DateTime.UtcNow;

        Movements.Add(StockMovement.Record(Id, MovementType.Adjustment, Math.Abs(newQuantity - before), before, Quantity, reference, notes, userId));
        RaiseDomainEvent(new StockLevelChangedDomainEvent(Id.Value, VariantId, BranchId, before, Quantity));

        return Result.Success;
    }

    public void Archive()
    {
        IsArchived = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Restore()
    {
        IsArchived = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetReorderThresholds(decimal reorderPoint, decimal reorderQuantity)
    {
        ReorderPoint = reorderPoint >= 0 ? reorderPoint : 0;
        ReorderQuantity = reorderQuantity >= 0 ? reorderQuantity : 0;
    }
}
