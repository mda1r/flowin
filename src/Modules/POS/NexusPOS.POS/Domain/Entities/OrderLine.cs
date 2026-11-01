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

    // The add-ons picked for this item, in the order the till asked them; null when there are none (and on older sales).
    public IReadOnlyList<OrderLineModifier>? Modifiers { get; private set; }

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
        string? notes = null,
        IReadOnlyList<OrderLineModifier>? modifiers = null)
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
            Modifiers = modifiers is { Count: > 0 } ? [.. modifiers] : null,
        };
    }

    // Blank notes mean none, so "" and null describe the same line.
    internal static string? NormalizeNotes(string? notes) =>
        string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

    // The same add-ons in any order: one oat latte with an extra shot is the same drink however it was tapped in.
    internal bool HasModifiers(IReadOnlyList<OrderLineModifier>? modifiers) =>
        ModifierKey(Modifiers) == ModifierKey(modifiers);

    private static string ModifierKey(IReadOnlyList<OrderLineModifier>? modifiers) =>
        modifiers is null ? string.Empty : string.Join(',', modifiers.Select(m => m.Id).Order());

    internal void UpdateQuantity(decimal quantity)
    {
        Quantity = quantity;
    }
}
