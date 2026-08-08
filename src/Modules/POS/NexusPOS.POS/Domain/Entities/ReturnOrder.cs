using ErrorOr;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Domain.Entities;

public sealed class ReturnOrder : AggregateRoot<ReturnOrderId>
{
    public Guid OriginalOrderId { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public decimal RefundAmount { get; private set; }
    public RefundMethod RefundMethod { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public List<ReturnOrderLine> Lines { get; private set; } = [];

    private ReturnOrder() { }

    public static ErrorOr<ReturnOrder> Create(
        Guid originalOrderId,
        Guid tenantId,
        Guid branchId,
        string currency,
        RefundMethod refundMethod,
        IEnumerable<(Guid lineId, Guid variantId, string productName, string variantName, decimal quantity, decimal unitPrice, ReturnReason reason)> returnLines)
    {
        List<ReturnOrderLine> lines = returnLines
            .Select(l => ReturnOrderLine.Create(l.lineId, l.variantId, l.productName, l.variantName, l.quantity, l.unitPrice, l.reason))
            .ToList();

        if (lines.Count == 0)
        {
            return Error.Validation("ReturnOrder.NoLines", "At least one line is required for a return.");
        }

        decimal refundAmount = Math.Round(lines.Sum(l => l.LineTotal), 4);

        ReturnOrder returnOrder = new()
        {
            Id = new ReturnOrderId(Guid.NewGuid()),
            OriginalOrderId = originalOrderId,
            TenantId = tenantId,
            BranchId = branchId,
            Currency = currency.ToUpperInvariant(),
            RefundMethod = refundMethod,
            RefundAmount = refundAmount,
            Lines = lines,
            CreatedAt = DateTime.UtcNow,
        };

        var lineItems = lines
            .Select(l => new ReturnOrderCompletedDomainEvent.LineItem(l.VariantId, l.Quantity))
            .ToList();
        returnOrder.RaiseDomainEvent(new ReturnOrderCompletedDomainEvent(
            returnOrder.Id.Value, originalOrderId, tenantId, branchId,
            refundAmount, currency.ToUpperInvariant(), lineItems));

        return returnOrder;
    }
}
