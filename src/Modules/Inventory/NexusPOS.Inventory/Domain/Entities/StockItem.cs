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

    public ErrorOr<Success> Receive(decimal quantity, string? reference = null, string? notes = null, DateTime? expiryDate = null)
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
        UpdatedAt = DateTime.UtcNow;

        Movements.Add(StockMovement.Record(Id, MovementType.Receive, quantity, before, Quantity, reference, notes));
        RaiseDomainEvent(new StockLevelChangedDomainEvent(Id.Value, VariantId, BranchId, before, Quantity));

        return Result.Success;
    }

    public ErrorOr<Success> Deduct(decimal quantity, MovementType type, string? reference = null, string? notes = null)
    {
        if (quantity <= 0)
        {
            return InventoryErrors.InvalidQuantity;
        }

        if (Quantity < quantity)
        {
            return InventoryErrors.InsufficientStock;
        }

        decimal before = Quantity;
        Quantity -= quantity;
        UpdatedAt = DateTime.UtcNow;

        Movements.Add(StockMovement.Record(Id, type, quantity, before, Quantity, reference, notes));
        RaiseDomainEvent(new StockLevelChangedDomainEvent(Id.Value, VariantId, BranchId, before, Quantity));

        if (Quantity <= ReorderPoint && ReorderPoint > 0)
        {
            RaiseDomainEvent(new LowStockAlertDomainEvent(Id.Value, VariantId, BranchId, Quantity, ReorderPoint));
        }

        return Result.Success;
    }

    public ErrorOr<Success> Adjust(decimal newQuantity, string? reference = null, string? notes = null)
    {
        if (newQuantity < 0)
        {
            return InventoryErrors.InvalidQuantity;
        }

        decimal before = Quantity;
        Quantity = newQuantity;
        UpdatedAt = DateTime.UtcNow;

        Movements.Add(StockMovement.Record(Id, MovementType.Adjustment, Math.Abs(newQuantity - before), before, Quantity, reference, notes));
        RaiseDomainEvent(new StockLevelChangedDomainEvent(Id.Value, VariantId, BranchId, before, Quantity));

        return Result.Success;
    }

    public void SetReorderThresholds(decimal reorderPoint, decimal reorderQuantity)
    {
        ReorderPoint = reorderPoint >= 0 ? reorderPoint : 0;
        ReorderQuantity = reorderQuantity >= 0 ? reorderQuantity : 0;
    }
}
