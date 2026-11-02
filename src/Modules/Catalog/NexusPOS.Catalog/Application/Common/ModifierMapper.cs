using NexusPOS.Catalog.Domain.Entities;

namespace NexusPOS.Catalog.Application.Common;

internal static class ModifierMapper
{
    public static ModifierGroupResponse ToResponse(ModifierGroup g, IReadOnlyList<Guid> productIds) => new(
        g.Id.Value,
        g.Name,
        g.IsRequired,
        g.MinSelect,
        g.MaxSelect,
        g.SortOrder,
        g.IsActive,
        [.. Ordered(g.Options).Select(ToResponse)],
        productIds,
        g.NameEn);

    public static ProductModifierGroupResponse ToProductResponse(ModifierGroup g) => new(
        g.Id.Value,
        g.Name,
        g.IsRequired,
        g.MinSelect,
        g.MaxSelect,
        [.. Ordered(g.Options).Where(o => o.IsActive).Select(ToResponse)],
        g.NameEn);

    private static ModifierOptionResponse ToResponse(ModifierOption o) =>
        new(o.Id.Value, o.Name, o.PriceDelta, o.IsActive, o.SortOrder, o.NameEn);

    private static IEnumerable<ModifierOption> Ordered(IEnumerable<ModifierOption> options) =>
        options.OrderBy(o => o.SortOrder).ThenBy(o => o.Name, StringComparer.Ordinal);
}
