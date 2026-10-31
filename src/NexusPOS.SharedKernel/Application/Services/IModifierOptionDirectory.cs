namespace NexusPOS.SharedKernel.Application.Services;

// Lets checkout price and check a drink's add-ons without referencing the Catalog module.
public interface IModifierOptionDirectory
{
    // The options asked for (unknown ids, or ids from another tenant, are left out) plus the rules of their groups
    // and of every active group attached to the given products, so a required group with nothing picked is caught too.
    Task<ModifierLookup> GetAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> optionIds,
        IReadOnlyCollection<Guid> productIds,
        CancellationToken cancellationToken = default);
}

public sealed record ModifierLookup(
    IReadOnlyDictionary<Guid, ModifierOptionInfo> Options,
    IReadOnlyDictionary<Guid, ModifierGroupRules> Groups)
{
    public static readonly ModifierLookup Empty =
        new(new Dictionary<Guid, ModifierOptionInfo>(), new Dictionary<Guid, ModifierGroupRules>());
}

// PriceDelta is net of VAT, the same basis as an order line's unit price.
public sealed record ModifierOptionInfo(Guid OptionId, Guid GroupId, string Name, decimal PriceDelta, bool IsActive);

// ProductIds are the products this group is attached to; an option may only be sold on one of them.
public sealed record ModifierGroupRules(
    Guid GroupId,
    string Name,
    bool IsRequired,
    int MinSelect,
    int MaxSelect,
    bool IsActive,
    IReadOnlyList<Guid> ProductIds);
