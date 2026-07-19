using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.ValueObjects;

namespace NexusPOS.POS.Domain.Entities;

public sealed class OrderLine : Entity<OrderLineId>
{
    public Guid VariantId { get; private set; }
    public string ProductName { get; private set; } = string.Empty;
    public string VariantName { get; private set; } = string.Empty;
    public Money UnitPrice { get; private set; } = null!;
    public decimal Quantity { get; private set; }
    public Discount LineDiscount { get; private set; } = Discount.None();

    public decimal LineSubtotal => UnitPrice.Amount * Quantity;
    public decimal LineDiscountAmount => LineDiscount.ComputeAmount(LineSubtotal);
    public decimal LineTotal => LineSubtotal - LineDiscountAmount;

    private OrderLine() { }

    internal static OrderLine Create(
        Guid variantId,
        string productName,
        string variantName,
        Money unitPrice,
        decimal quantity,
        Discount? lineDiscount = null)
    {
        return new OrderLine
        {
            Id = new OrderLineId(Guid.NewGuid()),
            VariantId = variantId,
            ProductName = productName.Trim(),
            VariantName = variantName.Trim(),
            UnitPrice = unitPrice,
            Quantity = quantity,
            LineDiscount = lineDiscount ?? Discount.None(),
        };
    }

    internal void UpdateQuantity(decimal quantity)
    {
        Quantity = quantity;
    }
}
