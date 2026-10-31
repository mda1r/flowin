using ErrorOr;
using FluentAssertions;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;

namespace NexusPOS.Inventory.UnitTests.Domain;

public sealed class StockCountTests
{
    private static readonly Guid _branchId = Guid.NewGuid();

    private static StockCountSession NewSession(params (Guid StockItemId, decimal System, decimal Cost)[] items)
    {
        StockCountSession session = StockCountSession.Create(
            _branchId, StockCountType.Monthly, DateTime.UtcNow.Date, DateTime.UtcNow.Date);
        foreach ((Guid stockItemId, decimal system, decimal cost) in items)
        {
            session.AddItem(StockCountItem.Create(session.Id, stockItemId, Guid.NewGuid(), system, cost));
        }

        return session;
    }

    // ── Session lifecycle ─────────────────────────────────────────────────────

    [Fact]
    public void Create_StartsInProgress()
    {
        StockCountSession session = NewSession();

        session.Status.Should().Be(StockCountStatus.InProgress);
        session.CompletedAt.Should().BeNull();
    }

    [Fact]
    public void Cancel_InProgress_MarksCancelled()
    {
        StockCountSession session = NewSession();

        ErrorOr<Success> result = session.Cancel();

        result.IsError.Should().BeFalse();
        session.Status.Should().Be(StockCountStatus.Cancelled);
    }

    [Fact]
    public void Cancel_Completed_ReturnsAlreadyCompleted()
    {
        StockCountSession session = NewSession();
        session.Complete();

        ErrorOr<Success> result = session.Cancel();

        result.FirstError.Should().Be(InventoryErrors.StockCountAlreadyCompleted);
        session.Status.Should().Be(StockCountStatus.Completed);
    }

    [Fact]
    public void Cancel_Twice_ReturnsNotInProgress()
    {
        StockCountSession session = NewSession();
        session.Cancel();

        ErrorOr<Success> result = session.Cancel();

        result.FirstError.Should().Be(InventoryErrors.StockCountNotInProgress);
    }

    [Fact]
    public void Complete_Cancelled_ReturnsNotInProgress()
    {
        StockCountSession session = NewSession();
        session.Cancel();

        ErrorOr<Success> result = session.Complete();

        result.FirstError.Should().Be(InventoryErrors.StockCountNotInProgress);
        session.Status.Should().Be(StockCountStatus.Cancelled);
    }

    [Fact]
    public void UpdateItemCount_AfterCancel_IsRejected()
    {
        Guid stockItemId = Guid.NewGuid();
        StockCountSession session = NewSession((stockItemId, 10, 2));
        session.Cancel();

        ErrorOr<Success> result = session.UpdateItemCount(stockItemId, 8);

        result.FirstError.Should().Be(InventoryErrors.StockCountNotInProgress);
    }

    // ── Counting ──────────────────────────────────────────────────────────────

    [Fact]
    public void UpdateItemCount_TracksDiscrepanciesAndTotals()
    {
        Guid short1 = Guid.NewGuid();
        Guid exact = Guid.NewGuid();
        Guid uncounted = Guid.NewGuid();
        StockCountSession session = NewSession((short1, 10, 2), (exact, 5, 4), (uncounted, 3, 1));

        session.UpdateItemCount(short1, 7);
        session.UpdateItemCount(exact, 5);

        session.CountedItems.Should().Be(2);
        session.DiscrepancyCount.Should().Be(1);
        session.Items.Single(i => i.StockItemId == short1).Difference.Should().Be(-3);
        session.TotalSystemValue.Should().Be(10 * 2 + 5 * 4 + 3 * 1);
        // Uncounted items keep their system quantity in the counted value.
        session.TotalCountedValue.Should().Be(7 * 2 + 5 * 4 + 3 * 1);
    }

    [Fact]
    public void UpdateItemCount_UnknownItem_ReturnsNotFound()
    {
        StockCountSession session = NewSession((Guid.NewGuid(), 1, 1));

        ErrorOr<Success> result = session.UpdateItemCount(Guid.NewGuid(), 1);

        result.FirstError.Should().Be(InventoryErrors.StockCountItemNotFound);
    }

    // ── Applying the count to stock ───────────────────────────────────────────

    [Fact]
    public void ApplyCountDifference_KeepsSalesMadeDuringTheCount()
    {
        // Snapshot 10, counted 8 (2 missing); 3 more sold before the count was completed.
        StockItem stock = StockItem.Create(Guid.NewGuid(), _branchId);
        stock.Receive(10);
        stock.Deduct(3, MovementType.Sale);

        ErrorOr<Success> result = stock.ApplyCountDifference(8 - 10, "جرد-test");

        result.IsError.Should().BeFalse();
        stock.Quantity.Should().Be(5);
        stock.Movements.Should().Contain(m =>
            m.Type == MovementType.Adjustment && m.QuantityBefore == 7 && m.QuantityAfter == 5 && m.Reference == "جرد-test");
    }

    [Fact]
    public void ApplyCountDifference_Surplus_AddsToCurrentLevel()
    {
        StockItem stock = StockItem.Create(Guid.NewGuid(), _branchId);
        stock.Receive(4);

        ErrorOr<Success> result = stock.ApplyCountDifference(2);

        result.IsError.Should().BeFalse();
        stock.Quantity.Should().Be(6);
    }

    [Fact]
    public void ApplyCountDifference_LargerShortageThanStock_StopsAtZero()
    {
        StockItem stock = StockItem.Create(Guid.NewGuid(), _branchId);
        stock.Receive(2);

        ErrorOr<Success> result = stock.ApplyCountDifference(-5);

        result.IsError.Should().BeFalse();
        stock.Quantity.Should().Be(0);
    }

    [Fact]
    public void ApplyCountDifference_Zero_RecordsNoMovement()
    {
        StockItem stock = StockItem.Create(Guid.NewGuid(), _branchId);
        stock.Receive(2);
        int movementsBefore = stock.Movements.Count;

        ErrorOr<Success> result = stock.ApplyCountDifference(0);

        result.IsError.Should().BeFalse();
        stock.Movements.Should().HaveCount(movementsBefore);
    }
}
