using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Inventory.Domain.Entities;

public sealed class StockMovement : Entity<StockMovementId>
{
    public StockItemId StockItemId { get; private set; } = null!;
    public MovementType Type { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal QuantityBefore { get; private set; }
    public decimal QuantityAfter { get; private set; }
    public string? Reference { get; private set; }
    public string? Notes { get; private set; }
    public DateTime OccurredAt { get; private set; }

    private StockMovement() { }

    internal static StockMovement Record(
        StockItemId stockItemId,
        MovementType type,
        decimal quantity,
        decimal quantityBefore,
        decimal quantityAfter,
        string? reference = null,
        string? notes = null)
    {
        return new StockMovement
        {
            Id = new StockMovementId(Guid.NewGuid()),
            StockItemId = stockItemId,
            Type = type,
            Quantity = quantity,
            QuantityBefore = quantityBefore,
            QuantityAfter = quantityAfter,
            Reference = reference?.Trim(),
            Notes = notes?.Trim(),
            OccurredAt = DateTime.UtcNow,
        };
    }
}
