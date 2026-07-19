using ErrorOr;
using FluentAssertions;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.Enums;
using NexusPOS.Purchasing.Domain.Events;
using NexusPOS.Purchasing.Domain.ValueObjects;

namespace NexusPOS.Purchasing.UnitTests.Domain;

public sealed class PurchaseOrderTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();
    private static readonly SupplierId _supplierId = new(Guid.NewGuid());
    private static readonly Guid _variantId = Guid.NewGuid();

    private static PurchaseOrder CreateDraftOrder() =>
        PurchaseOrder.Create(_tenantId, _branchId, _supplierId);

    private static PurchaseOrder CreateOrderWithLine()
    {
        PurchaseOrder order = CreateDraftOrder();
        order.AddLine(_variantId, "Widget", 10m, 5m);
        return order;
    }

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithValidArgs_CreatesDraftOrder()
    {
        PurchaseOrder order = CreateDraftOrder();

        order.TenantId.Should().Be(_tenantId);
        order.BranchId.Should().Be(_branchId);
        order.SupplierId.Should().Be(_supplierId);
        order.Status.Should().Be(PurchaseOrderStatus.Draft);
        order.Lines.Should().BeEmpty();
        order.TotalAmount.Should().Be(0m);
    }

    // ── AddLine ───────────────────────────────────────────────────────────────

    [Fact]
    public void AddLine_OnDraftOrder_AddsLineAndComputesTotal()
    {
        PurchaseOrder order = CreateDraftOrder();

        ErrorOr<PurchaseOrderLine> result = order.AddLine(_variantId, "Widget", 10m, 5m);

        result.IsError.Should().BeFalse();
        order.Lines.Should().ContainSingle();
        order.TotalAmount.Should().Be(50m);
    }

    [Fact]
    public void AddLine_MultipleLines_SumsTotals()
    {
        PurchaseOrder order = CreateDraftOrder();

        order.AddLine(_variantId, "Widget", 10m, 5m);
        order.AddLine(Guid.NewGuid(), "Gadget", 25m, 2m);

        order.TotalAmount.Should().Be(100m);
    }

    [Fact]
    public void AddLine_OnNonDraftOrder_ReturnsError()
    {
        PurchaseOrder order = CreateOrderWithLine();
        order.Send();

        ErrorOr<PurchaseOrderLine> result = order.AddLine(_variantId, "Extra", 5m, 1m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.PurchaseOrderNotDraft);
    }

    [Fact]
    public void AddLine_ZeroQuantity_ReturnsError()
    {
        PurchaseOrder order = CreateDraftOrder();

        ErrorOr<PurchaseOrderLine> result = order.AddLine(_variantId, "Widget", 10m, 0m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.InvalidQuantity);
    }

    [Fact]
    public void AddLine_NegativeUnitCost_ReturnsError()
    {
        PurchaseOrder order = CreateDraftOrder();

        ErrorOr<PurchaseOrderLine> result = order.AddLine(_variantId, "Widget", -1m, 5m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.InvalidUnitCost);
    }

    // ── RemoveLine ────────────────────────────────────────────────────────────

    [Fact]
    public void RemoveLine_ExistingLine_RemovesLine()
    {
        PurchaseOrder order = CreateDraftOrder();
        ErrorOr<PurchaseOrderLine> addResult = order.AddLine(_variantId, "Widget", 10m, 5m);
        PurchaseOrderLineId lineId = addResult.Value.Id;

        ErrorOr<Success> removeResult = order.RemoveLine(lineId);

        removeResult.IsError.Should().BeFalse();
        order.Lines.Should().BeEmpty();
    }

    [Fact]
    public void RemoveLine_NonExistentLine_ReturnsError()
    {
        PurchaseOrder order = CreateDraftOrder();

        ErrorOr<Success> result = order.RemoveLine(new PurchaseOrderLineId(Guid.NewGuid()));

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.PurchaseOrderLineNotFound);
    }

    [Fact]
    public void RemoveLine_OnSentOrder_ReturnsError()
    {
        PurchaseOrder order = CreateOrderWithLine();
        order.Send();
        PurchaseOrderLineId lineId = order.Lines[0].Id;

        ErrorOr<Success> result = order.RemoveLine(lineId);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.PurchaseOrderNotDraft);
    }

    // ── Send ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Send_DraftOrderWithLines_TransitionsToSent()
    {
        PurchaseOrder order = CreateOrderWithLine();

        ErrorOr<Success> result = order.Send();

        result.IsError.Should().BeFalse();
        order.Status.Should().Be(PurchaseOrderStatus.Sent);
    }

    [Fact]
    public void Send_EmptyDraftOrder_ReturnsError()
    {
        PurchaseOrder order = CreateDraftOrder();

        ErrorOr<Success> result = order.Send();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.EmptyPurchaseOrder);
    }

    [Fact]
    public void Send_AlreadySentOrder_ReturnsError()
    {
        PurchaseOrder order = CreateOrderWithLine();
        order.Send();

        ErrorOr<Success> result = order.Send();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.PurchaseOrderNotDraft);
    }

    // ── ReceiveAll ────────────────────────────────────────────────────────────

    [Fact]
    public void ReceiveAll_SentOrder_TransitionsToReceivedAndRaisesEvent()
    {
        PurchaseOrder order = CreateOrderWithLine();
        order.Send();
        order.ClearDomainEvents();

        ErrorOr<Success> result = order.ReceiveAll();

        result.IsError.Should().BeFalse();
        order.Status.Should().Be(PurchaseOrderStatus.Received);
        order.ReceivedAt.Should().NotBeNull();
        order.Lines.Should().OnlyContain(l => l.IsFullyReceived);
        order.DomainEvents.Should().ContainSingle(e => e is PurchaseOrderReceivedDomainEvent);
    }

    [Fact]
    public void ReceiveAll_DraftOrder_ReturnsError()
    {
        PurchaseOrder order = CreateOrderWithLine();

        ErrorOr<Success> result = order.ReceiveAll();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.PurchaseOrderNotSent);
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    [Fact]
    public void Cancel_DraftOrder_TransitionsToCancelled()
    {
        PurchaseOrder order = CreateDraftOrder();

        ErrorOr<Success> result = order.Cancel("No longer needed");

        result.IsError.Should().BeFalse();
        order.Status.Should().Be(PurchaseOrderStatus.Cancelled);
        order.DomainEvents.Should().ContainSingle(e => e is PurchaseOrderCancelledDomainEvent);
    }

    [Fact]
    public void Cancel_SentOrder_TransitionsToCancelled()
    {
        PurchaseOrder order = CreateOrderWithLine();
        order.Send();

        ErrorOr<Success> result = order.Cancel();

        result.IsError.Should().BeFalse();
        order.Status.Should().Be(PurchaseOrderStatus.Cancelled);
    }

    [Fact]
    public void Cancel_ReceivedOrder_ReturnsError()
    {
        PurchaseOrder order = CreateOrderWithLine();
        order.Send();
        order.ReceiveAll();

        ErrorOr<Success> result = order.Cancel();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.PurchaseOrderAlreadyCompleted);
    }

    [Fact]
    public void Cancel_AlreadyCancelledOrder_ReturnsError()
    {
        PurchaseOrder order = CreateDraftOrder();
        order.Cancel();

        ErrorOr<Success> result = order.Cancel();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PurchasingErrors.PurchaseOrderAlreadyCompleted);
    }

    // ── PurchaseOrderLine ─────────────────────────────────────────────────────

    [Fact]
    public void ReceiveAll_Line_SetsReceivedQuantityToOrdered()
    {
        PurchaseOrder order = CreateDraftOrder();
        order.AddLine(_variantId, "Widget", 10m, 5m);
        order.Send();

        order.ReceiveAll();

        order.Lines[0].ReceivedQuantity.Should().Be(5m);
        order.Lines[0].IsFullyReceived.Should().BeTrue();
    }
}
