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
    public decimal CostPrice { get; private set; }
    public decimal Quantity { get; private set; }
    public Discount LineDiscount { get; private set; } = Discount.None();

    // What the customer asked for on this item ("no sugar", "oat milk"); kept on the invoice and the kitchen ticket.
    public string? Notes { get; private set; }

    public decimal LineSubtotal => UnitPrice.Amount * Quantity;
    public decimal LineDiscountAmount => LineDiscount.ComputeAmount(LineSubtotal);
    public decimal LineTotal => LineSubtotal - LineDiscountAmount;
    public decimal LineCost => CostPrice * Quantity;

    private OrderLine() { }

    internal static OrderLine Create(
        Guid variantId,
        string productName,
        string variantName,
        Money unitPrice,
        decimal costPrice,
        decimal quantity,
        Discount? lineDiscount = null,
        string? notes = null)
    {
        return new OrderLine
        {
            Id = new OrderLineId(Guid.NewGuid()),
            VariantId = variantId,
            ProductName = productName.Trim(),
            VariantName = variantName.Trim(),
            UnitPrice = unitPrice,
            CostPrice = costPrice,
            Quantity = quantity,
            LineDiscount = lineDiscount ?? Discount.None(),
            Notes = NormalizeNotes(notes),
        };
    }

    // Blank notes mean none, so "" and null describe the same line.
    internal static string? NormalizeNotes(string? notes) =>
        string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

    internal void UpdateQuantity(decimal quantity)
    {
        Quantity = quantity;
    }
}
