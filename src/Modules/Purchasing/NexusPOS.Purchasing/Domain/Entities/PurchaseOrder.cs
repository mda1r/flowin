using ErrorOr;
using NexusPOS.Purchasing.Domain.Enums;
using NexusPOS.Purchasing.Domain.Events;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Purchasing.Domain.Entities;

public sealed class PurchaseOrder : AggregateRoot<PurchaseOrderId>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public SupplierId SupplierId { get; private set; } = null!;
    public PurchaseOrderStatus Status { get; private set; }
    public DateTime? ExpectedDeliveryDate { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? ReceivedAt { get; private set; }

    public List<PurchaseOrderLine> Lines { get; private set; } = [];

    public decimal TotalAmount => Lines.Sum(l => l.LineTotal);

    private PurchaseOrder() { }

    public static PurchaseOrder Create(Guid tenantId, Guid branchId, SupplierId supplierId, DateTime? expectedDeliveryDate = null, string? notes = null)
    {
        return new PurchaseOrder
        {
            Id = new PurchaseOrderId(Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.Draft,
            ExpectedDeliveryDate = expectedDeliveryDate,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public ErrorOr<PurchaseOrderLine> AddLine(Guid variantId, string description, decimal unitCost, decimal quantity)
    {
        if (Status != PurchaseOrderStatus.Draft)
        {
            return PurchasingErrors.PurchaseOrderNotDraft;
        }

        if (quantity <= 0)
        {
            return PurchasingErrors.InvalidQuantity;
        }

        if (unitCost < 0)
        {
            return PurchasingErrors.InvalidUnitCost;
        }

        PurchaseOrderLine line = PurchaseOrderLine.Create(variantId, description, unitCost, quantity);
        Lines.Add(line);
        UpdatedAt = DateTime.UtcNow;
        return line;
    }

    public ErrorOr<Success> RemoveLine(PurchaseOrderLineId lineId)
    {
        if (Status != PurchaseOrderStatus.Draft)
        {
            return PurchasingErrors.PurchaseOrderNotDraft;
        }

        PurchaseOrderLine? line = Lines.Find(l => l.Id == lineId);
        if (line is null)
        {
            return PurchasingErrors.PurchaseOrderLineNotFound;
        }

        Lines.Remove(line);
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Send()
    {
        if (Status != PurchaseOrderStatus.Draft)
        {
            return PurchasingErrors.PurchaseOrderNotDraft;
        }

        if (Lines.Count == 0)
        {
            return PurchasingErrors.EmptyPurchaseOrder;
        }

        Status = PurchaseOrderStatus.Sent;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> ReceiveAll()
    {
        if (Status is not (PurchaseOrderStatus.Sent or PurchaseOrderStatus.PartiallyReceived))
        {
            return PurchasingErrors.PurchaseOrderNotSent;
        }

        foreach (PurchaseOrderLine line in Lines)
        {
            line.ReceiveAll();
        }

        Status = PurchaseOrderStatus.Received;
        ReceivedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;

        RaiseDomainEvent(new PurchaseOrderReceivedDomainEvent(
            Id.Value, TenantId, BranchId,
            Lines.Select(l => (l.VariantId, l.OrderedQuantity)).ToList()));

        return Result.Success;
    }

    public ErrorOr<Success> Cancel(string? reason = null)
    {
        if (Status is PurchaseOrderStatus.Received or PurchaseOrderStatus.Cancelled)
        {
            return PurchasingErrors.PurchaseOrderAlreadyCompleted;
        }

        Status = PurchaseOrderStatus.Cancelled;
        Notes = reason?.Trim() ?? Notes;
        UpdatedAt = DateTime.UtcNow;

        RaiseDomainEvent(new PurchaseOrderCancelledDomainEvent(Id.Value, TenantId, BranchId, reason));
        return Result.Success;
    }
}
