namespace NexusPOS.Catalog.Application.Common;

// The editor's view of a group: every option (active or not) and the products it is attached to.
public sealed record ModifierGroupResponse(
    Guid Id,
    string Name,
    bool IsRequired,
    int MinSelect,
    int MaxSelect,
    int SortOrder,
    bool IsActive,
    IReadOnlyList<ModifierOptionResponse> Options,
    IReadOnlyList<Guid> ProductIds,
    string? NameEn = null);

// PriceDelta is net of VAT; screens add VAT before showing it.
public sealed record ModifierOptionResponse(
    Guid Id,
    string Name,
    decimal PriceDelta,
    bool IsActive,
    int SortOrder,
    string? NameEn = null);

// A group as the till sees it on a product: in the product's order, active options only.
public sealed record ProductModifierGroupResponse(
    Guid Id,
    string Name,
    bool IsRequired,
    int MinSelect,
    int MaxSelect,
    IReadOnlyList<ModifierOptionResponse> Options,
    string? NameEn = null);
