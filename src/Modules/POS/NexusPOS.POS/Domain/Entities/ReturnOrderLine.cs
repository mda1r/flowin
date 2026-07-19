using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Domain.Entities;

public sealed class ReturnOrderLine : Entity<ReturnOrderLineId>
{
    public Guid OriginalLineId { get; private set; }
    public Guid VariantId { get; private set; }
    public string ProductName { get; private set; } = string.Empty;
    public string VariantName { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal LineTotal { get; private set; }
    public ReturnReason Reason { get; private set; }

    private ReturnOrderLine() { }

    internal static ReturnOrderLine Create(
        Guid originalLineId,
        Guid variantId,
        string productName,
        string variantName,
        decimal quantity,
        decimal unitPrice,
        ReturnReason reason)
    {
        return new ReturnOrderLine
        {
            Id = new ReturnOrderLineId(Guid.NewGuid()),
            OriginalLineId = originalLineId,
            VariantId = variantId,
            ProductName = productName,
            VariantName = variantName,
            Quantity = quantity,
            UnitPrice = unitPrice,
            LineTotal = Math.Round(quantity * unitPrice, 4),
            Reason = reason,
        };
    }
}
