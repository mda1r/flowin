using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Domain.Entities;

// Attaches a modifier group to a product; SortOrder is the order the till asks the groups in.
public sealed class ProductModifierGroup
{
    public const int MaxGroupsPerProduct = 20;

    public ProductId ProductId { get; private set; } = null!;
    public ModifierGroupId GroupId { get; private set; } = null!;
    public int SortOrder { get; private set; }

    private ProductModifierGroup() { }

    public static ProductModifierGroup Create(ProductId productId, ModifierGroupId groupId, int sortOrder) => new()
    {
        ProductId = productId,
        GroupId = groupId,
        SortOrder = sortOrder,
    };

    internal void MoveTo(int sortOrder) => SortOrder = sortOrder;
}
