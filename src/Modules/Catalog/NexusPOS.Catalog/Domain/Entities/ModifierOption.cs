using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Catalog.Domain.Entities;

// One choice inside a modifier group (oat milk, an extra shot). PriceDelta is net of VAT, like order line prices.
public sealed class ModifierOption : Entity<ModifierOptionId>
{
    public ModifierGroupId GroupId { get; private set; } = null!;
    public string Name { get; private set; } = null!;
    public decimal PriceDelta { get; private set; }
    public bool IsActive { get; private set; }
    public int SortOrder { get; private set; }

    private ModifierOption() { }

    internal static ModifierOption Create(ModifierGroupId groupId, ModifierOptionDraft draft) => new()
    {
        Id = new ModifierOptionId(Guid.NewGuid()),
        GroupId = groupId,
        Name = draft.Name.Trim(),
        PriceDelta = draft.PriceDelta,
        IsActive = draft.IsActive,
        SortOrder = draft.SortOrder,
    };

    internal void Update(ModifierOptionDraft draft)
    {
        Name = draft.Name.Trim();
        PriceDelta = draft.PriceDelta;
        IsActive = draft.IsActive;
        SortOrder = draft.SortOrder;
    }
}

// An option as the editor sends it; Id is the existing option to keep, or null for a new one.
public sealed record ModifierOptionDraft(Guid? Id, string Name, decimal PriceDelta, bool IsActive = true, int SortOrder = 0);
