using ErrorOr;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Inventory.Domain.Entities;

public sealed class StockCountSession : AggregateRoot<StockCountSessionId>
{
    public Guid BranchId { get; private set; }
    public StockCountType Type { get; private set; }
    public StockCountStatus Status { get; private set; }
    public DateTime PeriodStart { get; private set; }
    public DateTime PeriodEnd { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    private readonly List<StockCountItem> _items = [];
    public IReadOnlyList<StockCountItem> Items => _items.AsReadOnly();

    public int TotalItems => _items.Count;
    public int CountedItems => _items.Count(i => i.CountedQuantity.HasValue);
    public int DiscrepancyCount => _items.Count(i => i.HasDiscrepancy);
    public decimal TotalSystemValue => _items.Sum(i => i.SystemValue);
    public decimal TotalCountedValue => _items.Sum(i => i.CountedValue);
    public decimal TotalTaxAmount => _items.Sum(i => i.TaxAmount);

    private StockCountSession() { }

    public static StockCountSession Create(
        Guid branchId,
        StockCountType type,
        DateTime periodStart,
        DateTime periodEnd,
        string? notes = null) =>
        new()
        {
            Id = new StockCountSessionId(Guid.NewGuid()),
            BranchId = branchId,
            Type = type,
            Status = StockCountStatus.InProgress,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            Notes = notes,
            CreatedAt = DateTime.UtcNow,
        };

    public void AddItem(StockCountItem item) => _items.Add(item);

    public ErrorOr<Success> UpdateItemCount(Guid stockItemId, decimal countedQuantity)
    {
        if (Status != StockCountStatus.InProgress)
        {
            return InventoryErrors.StockCountNotInProgress;
        }

        StockCountItem? item = _items.FirstOrDefault(i => i.StockItemId == stockItemId);
        if (item is null)
        {
            return InventoryErrors.StockCountItemNotFound;
        }

        item.UpdateCount(countedQuantity);
        return Result.Success;
    }

    public ErrorOr<Success> Complete()
    {
        if (Status != StockCountStatus.InProgress)
        {
            return InventoryErrors.StockCountNotInProgress;
        }

        Status = StockCountStatus.Completed;
        CompletedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Cancel()
    {
        if (Status == StockCountStatus.Completed)
        {
            return InventoryErrors.StockCountAlreadyCompleted;
        }

        Status = StockCountStatus.Cancelled;
        return Result.Success;
    }
}
