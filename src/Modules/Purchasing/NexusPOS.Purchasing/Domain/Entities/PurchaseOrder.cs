using ErrorOr;
using NexusPOS.Purchasing.Domain.Enums;
using NexusPOS.Purchasing.Domain.Events;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.Events;

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
        => AddLineCore(() => PurchaseOrderLine.Create(variantId, description, unitCost, quantity), unitCost, quantity);

    public ErrorOr<PurchaseOrderLine> AddMaterialLine(Guid stockMaterialId, string description, decimal unitCost, decimal quantity)
        => AddLineCore(() => PurchaseOrderLine.CreateForMaterial(stockMaterialId, description, unitCost, quantity), unitCost, quantity);

    private ErrorOr<PurchaseOrderLine> AddLineCore(Func<PurchaseOrderLine> create, decimal unitCost, decimal quantity)
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

        PurchaseOrderLine line = create();
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

        RaiseProductsReceived();
        RaiseMaterialsPurchased();

        return Result.Success;
    }

    // Re-sends the receipt to Inventory, which applies each order's products and materials at most once.
    public ErrorOr<Success> RetryInventoryReceipt()
    {
        if (Status != PurchaseOrderStatus.Received)
        {
            return PurchasingErrors.PurchaseOrderNotReceived;
        }

        bool products = RaiseProductsReceived();
        bool materials = RaiseMaterialsPurchased();
        return products || materials ? Result.Success : PurchasingErrors.EmptyPurchaseOrder;
    }

    private bool RaiseProductsReceived()
    {
        List<PurchaseOrderReceivedDomainEvent.Item> productLines = Lines
            .Where(l => !l.IsMaterial)
            .Select(l => new PurchaseOrderReceivedDomainEvent.Item(l.VariantId, l.OrderedQuantity, l.UnitCost))
            .ToList();
        if (productLines.Count == 0)
        {
            return false;
        }

        RaiseDomainEvent(new PurchaseOrderReceivedDomainEvent(
            Id.Value, TenantId, BranchId, ReceivedAt ?? DateTime.UtcNow, productLines));
        return true;
    }

    private bool RaiseMaterialsPurchased()
    {
        List<StockMaterialsPurchasedDomainEvent.Line> materialLines = Lines
            .Where(l => l.IsMaterial)
            .Select(l => new StockMaterialsPurchasedDomainEvent.Line(l.StockMaterialId!.Value, l.OrderedQuantity, l.UnitCost))
            .ToList();
        if (materialLines.Count == 0)
        {
            return false;
        }

        RaiseDomainEvent(new StockMaterialsPurchasedDomainEvent(TenantId, Id.Value, materialLines));
        return true;
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
