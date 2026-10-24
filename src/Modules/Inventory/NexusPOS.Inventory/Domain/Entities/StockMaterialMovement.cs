using NexusPOS.Inventory.Domain.Enums;

namespace NexusPOS.Inventory.Domain.Entities;

public sealed class StockMaterialMovement
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid MaterialId { get; private set; }
    public StockMaterialMovementType Type { get; private set; }
    public decimal QuantityChange { get; private set; }
    public decimal? UnitCost { get; private set; }
    public decimal QuantityAfter { get; private set; }
    public decimal CostAfter { get; private set; }
    public string? Note { get; private set; }
    public Guid? UserId { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private StockMaterialMovement() { }

    public static StockMaterialMovement Record(
        StockMaterial material,
        StockMaterialMovementType type,
        decimal quantityChange,
        decimal? unitCost,
        string? note,
        Guid? userId)
    {
        return new StockMaterialMovement
        {
            Id = Guid.NewGuid(),
            TenantId = material.TenantId,
            MaterialId = material.Id,
            Type = type,
            QuantityChange = quantityChange,
            UnitCost = unitCost,
            QuantityAfter = material.CurrentQuantityInStorageUnits,
            CostAfter = material.CurrentCost,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
        };
    }
}
