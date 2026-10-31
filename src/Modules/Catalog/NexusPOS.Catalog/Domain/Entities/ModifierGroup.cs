using ErrorOr;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Catalog.Domain.Entities;

// A set of add-ons a drink can carry (milk type, extra shot, syrup, sugar level) and how many may be picked.
public sealed class ModifierGroup : AggregateRoot<ModifierGroupId>
{
    public const int NameMaxLength = 100;
    public const int MaxOptions = 50;

    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = null!;
    public bool IsRequired { get; private set; }
    public int MinSelect { get; private set; }
    public int MaxSelect { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public List<ModifierOption> Options { get; private set; } = [];

    private ModifierGroup() { }

    public static ErrorOr<ModifierGroup> Create(
        Guid tenantId,
        string name,
        bool isRequired,
        int minSelect,
        int maxSelect,
        int sortOrder,
        IReadOnlyList<ModifierOptionDraft> options)
    {
        ErrorOr<Success> valid = Validate(name, isRequired, minSelect, maxSelect, options);
        if (valid.IsError)
        {
            return valid.Errors;
        }

        ModifierGroup group = new()
        {
            Id = new ModifierGroupId(Guid.NewGuid()),
            TenantId = tenantId,
            Name = name.Trim(),
            IsRequired = isRequired,
            MinSelect = minSelect,
            MaxSelect = maxSelect,
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        foreach (ModifierOptionDraft draft in options)
        {
            group.Options.Add(ModifierOption.Create(group.Id, Clean(draft)));
        }

        return group;
    }

    // Replaces the options with the editor's list. An option sent back with its id is updated in place, so the
    // id old orders point at keeps resolving; ids not sent are removed, and drafts without a known id are added.
    public ErrorOr<Success> Update(
        string name,
        bool isRequired,
        int minSelect,
        int maxSelect,
        int sortOrder,
        IReadOnlyList<ModifierOptionDraft> options)
    {
        ErrorOr<Success> valid = Validate(name, isRequired, minSelect, maxSelect, options);
        if (valid.IsError)
        {
            return valid.Errors;
        }

        Name = name.Trim();
        IsRequired = isRequired;
        MinSelect = minSelect;
        MaxSelect = maxSelect;
        SortOrder = sortOrder;

        HashSet<Guid> kept = [.. options.Where(o => o.Id.HasValue).Select(o => o.Id!.Value)];
        Options.RemoveAll(o => !kept.Contains(o.Id.Value));

        foreach (ModifierOptionDraft draft in options)
        {
            ModifierOption? existing = draft.Id is Guid id ? Options.FirstOrDefault(o => o.Id.Value == id) : null;
            if (existing is null)
            {
                Options.Add(ModifierOption.Create(Id, Clean(draft)));
            }
            else
            {
                existing.Update(Clean(draft));
            }
        }

        return Result.Success;
    }

    // Deactivated rather than deleted: past orders keep pointing at the group and its options.
    public void Deactivate() => IsActive = false;

    // The rules every save must meet: 0 <= Min <= Max, Max >= 1, a required group asks for at least one pick
    // (and a group with a minimum is required), prices are never negative, and the active options can cover Min.
    internal static ErrorOr<Success> Validate(
        string name, bool isRequired, int minSelect, int maxSelect, IReadOnlyList<ModifierOptionDraft> options)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return CatalogErrors.ModifierGroupNameRequired;
        }

        if (minSelect < 0)
        {
            return CatalogErrors.ModifierMinNegative;
        }

        if (maxSelect < 1)
        {
            return CatalogErrors.ModifierMaxTooSmall;
        }

        if (minSelect > maxSelect)
        {
            return CatalogErrors.ModifierMinAboveMax;
        }

        if (isRequired && minSelect < 1)
        {
            return CatalogErrors.ModifierRequiredNeedsMin;
        }

        if (!isRequired && minSelect > 0)
        {
            return CatalogErrors.ModifierMinNeedsRequired;
        }

        if (options.Count == 0)
        {
            return CatalogErrors.ModifierNoOptions;
        }

        if (options.Count > MaxOptions)
        {
            return CatalogErrors.ModifierTooManyOptions;
        }

        if (options.Any(o => string.IsNullOrWhiteSpace(o.Name)))
        {
            return CatalogErrors.ModifierOptionNameRequired;
        }

        if (options.Any(o => o.PriceDelta < 0))
        {
            return CatalogErrors.ModifierPriceNegative;
        }

        if (options.GroupBy(o => o.Name.Trim(), StringComparer.OrdinalIgnoreCase).Any(g => g.Count() > 1))
        {
            return CatalogErrors.ModifierOptionDuplicate;
        }

        if (options.Where(o => o.Id.HasValue).GroupBy(o => o.Id).Any(g => g.Count() > 1))
        {
            return CatalogErrors.ModifierOptionDuplicate;
        }

        if (options.Count(o => o.IsActive) < minSelect)
        {
            return CatalogErrors.ModifierMinAboveOptions;
        }

        return Result.Success;
    }

    // Net prices are kept to four places, like order lines.
    private static ModifierOptionDraft Clean(ModifierOptionDraft draft) =>
        draft with { Name = draft.Name.Trim(), PriceDelta = Math.Round(draft.PriceDelta, 4, MidpointRounding.AwayFromZero) };
}
