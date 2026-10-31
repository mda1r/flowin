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

    // Who gave the refund and on which shift, so owners can trace every riyal that left the drawer.
    public Guid? CreatedByUserId { get; private set; }
    public string? CreatedByName { get; private set; }
    public Guid? ShiftId { get; private set; }
    public string? Note { get; private set; }

    // Set by the till for each return; a resend after a dropped connection gives back the same return.
    public Guid? ClientReference { get; private set; }

    public List<ReturnOrderLine> Lines { get; private set; } = [];

    private ReturnOrder() { }

    public static ErrorOr<ReturnOrder> Create(
        Order order,
        IEnumerable<ReturnOrder> previousReturns,
        IEnumerable<(Guid lineId, decimal quantity, ReturnReason reason)> returnLines,
        RefundMethod refundMethod,
        bool restockItems = true,
        Guid? createdByUserId = null,
        string? createdByName = null,
        Guid? shiftId = null,
        string? note = null,
        Guid? clientReference = null,
        ReturnOrderCompletedDomainEvent.CustomerLoyalty? loyalty = null)
    {
        if (order.Status != OrderStatus.Completed)
        {
            return Error.Validation("ReturnOrder.OrderNotCompleted", "Only completed orders can be returned.");
        }

        List<ReturnOrder> earlier = [.. previousReturns];
        Dictionary<Guid, decimal> alreadyReturned = earlier
            .SelectMany(r => r.Lines)
            .GroupBy(l => l.OriginalLineId)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.Quantity));

        List<(Guid lineId, decimal quantity, ReturnReason reason)> requested = [.. returnLines];
        if (requested.Count == 0)
        {
            return Error.Validation("ReturnOrder.NoLines", "At least one line is required for a return.");
        }

        if (requested.Select(l => l.lineId).Distinct().Count() != requested.Count)
        {
            return Error.Validation("ReturnOrder.DuplicateLine", "Each line can appear only once in a return.");
        }

        List<ReturnOrderLine> lines = [];
        foreach ((Guid lineId, decimal quantity, ReturnReason reason) in requested)
        {
            OrderLine? originalLine = order.Lines.Find(l => l.Id.Value == lineId);
            if (originalLine is null)
            {
                return PosErrors.OrderLineNotFound;
            }

            if (quantity <= 0)
            {
                return PosErrors.InvalidQuantity;
            }

            decimal remaining = originalLine.Quantity - alreadyReturned.GetValueOrDefault(lineId, 0m);
            if (quantity > remaining)
            {
                return Error.Validation("ReturnOrder.QuantityExceeded",
                    $"Return quantity for line {lineId} exceeds the remaining returnable quantity ({remaining}).");
            }

            lines.Add(ReturnOrderLine.Create(
                lineId, originalLine.VariantId, originalLine.ProductName, originalLine.VariantName,
                quantity, order.NetUnitPaid(originalLine), reason));
        }

        // Never give back more than was paid, counting what earlier returns already refunded.
        decimal refundable = Math.Max(order.TotalAmount - earlier.Sum(r => r.RefundAmount), 0m);
        decimal pretaxTotal = lines.Sum(l => l.LineTotal);
        decimal refundAmount = Math.Min(Math.Round(pretaxTotal * (1 + order.TaxRate), 4), refundable);

        // The last units back settle the bill exactly, so rounding never leaves halalas behind.
        bool returnsEverything = order.Lines.TrueForAll(l =>
            alreadyReturned.GetValueOrDefault(l.Id.Value, 0m) + lines.Where(r => r.OriginalLineId == l.Id.Value).Sum(r => r.Quantity) >= l.Quantity);
        if (returnsEverything)
        {
            refundAmount = refundable;
        }

        decimal refundTax = RefundTaxOf(refundAmount, order.TaxRate);

        ReturnOrder returnOrder = new()
        {
            Id = new ReturnOrderId(Guid.NewGuid()),
            OriginalOrderId = order.Id.Value,
            TenantId = order.TenantId,
            BranchId = order.BranchId,
            Currency = order.Currency.ToUpperInvariant(),
            RefundMethod = refundMethod,
            RefundAmount = refundAmount,
            Lines = lines,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = createdByUserId,
            CreatedByName = string.IsNullOrWhiteSpace(createdByName) ? null : createdByName.Trim(),
            ShiftId = shiftId,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            ClientReference = clientReference,
        };

        var lineItems = lines
            .Select(l => new ReturnOrderCompletedDomainEvent.LineItem(l.VariantId, l.Quantity))
            .ToList();
        // The caller passes what earlier returns refunded; this return's refund is added here.
        ReturnOrderCompletedDomainEvent.CustomerLoyalty? eventLoyalty =
            loyalty is null ? null : loyalty with { RefundedToDate = loyalty.RefundedToDate + refundAmount };
        returnOrder.RaiseDomainEvent(new ReturnOrderCompletedDomainEvent(
            returnOrder.Id.Value, returnOrder.OriginalOrderId, returnOrder.TenantId, returnOrder.BranchId,
            refundAmount, returnOrder.Currency, lineItems, restockItems, refundTax, eventLoyalty));

        return returnOrder;
    }

    // The VAT inside a VAT-inclusive refund.
    public static decimal RefundTaxOf(decimal refundAmount, decimal taxRate) =>
        taxRate <= 0 ? 0m : Math.Round(refundAmount * taxRate / (1 + taxRate), 4);
}
