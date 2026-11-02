namespace NexusPOS.Catalog.Presentation.Requests;

// Used for both create and update. Option prices are net of VAT; send an existing option's id to keep it.
public sealed record ModifierGroupRequest(
    string Name,
    bool IsRequired,
    int MinSelect,
    int MaxSelect,
    int SortOrder,
    IReadOnlyList<ModifierOptionRequest>? Options,
    string? NameEn = null);

public sealed record ModifierOptionRequest(
    Guid? Id,
    string Name,
    decimal PriceDelta,
    bool IsActive = true,
    int SortOrder = 0,
    string? NameEn = null);

public sealed record SetProductModifierGroupsRequest(IReadOnlyList<Guid>? GroupIds);
