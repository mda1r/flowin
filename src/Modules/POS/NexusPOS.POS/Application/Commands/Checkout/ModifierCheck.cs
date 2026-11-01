using ErrorOr;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.POS.Application.Commands.Checkout;

// A drink's add-ons checked against the catalogue as it is now: every picked option is on sale and belongs to a group
// attached to that product, and every active group attached to it gets between its minimum and maximum picks.
// productOf maps each variant id to its product; lookup comes from IModifierOptionDirectory for the caller's tenant.
internal static class ModifierCheck
{
    public static ErrorOr<Success> Check(
        CheckoutOrderCommand cmd, IReadOnlyDictionary<Guid, Guid> productOf, ModifierLookup lookup)
    {
        foreach (CheckoutOrderCommand.Line line in cmd.Lines)
        {
            ErrorOr<Success> checkedLine = CheckLine(line, productOf, lookup);
            if (checkedLine.IsError)
            {
                return checkedLine.Errors;
            }
        }

        return Result.Success;
    }

    // For a sale already made offline: the lines that would not pass Check, by name, for the manager to review.
    public static List<string> Unverified(
        CheckoutOrderCommand cmd, IReadOnlyDictionary<Guid, Guid> productOf, ModifierLookup lookup) =>
        [.. cmd.Lines.Where(l => CheckLine(l, productOf, lookup).IsError).Select(l => l.ProductName)];

    // The net price the known add-ons put on one unit; an option the catalogue no longer has adds nothing.
    public static decimal Deltas(CheckoutOrderCommand.Line line, ModifierLookup lookup) =>
        Known(line, lookup).Sum(o => o.PriceDelta);

    public static int KnownCount(CheckoutOrderCommand.Line line, ModifierLookup lookup) => Known(line, lookup).Count();

    // What the line keeps: the known add-ons in the order the till sent them, with today's name and price.
    public static List<OrderLineModifier>? ForLine(CheckoutOrderCommand.Line line, ModifierLookup lookup)
    {
        List<OrderLineModifier> picked = [.. Known(line, lookup).Select(o => new OrderLineModifier(o.OptionId, o.Name, o.PriceDelta))];
        return picked.Count == 0 ? null : picked;
    }

    private static ErrorOr<Success> CheckLine(
        CheckoutOrderCommand.Line line, IReadOnlyDictionary<Guid, Guid> productOf, ModifierLookup lookup)
    {
        List<Guid> picked = Picked(line);
        bool hasProduct = productOf.TryGetValue(line.VariantId, out Guid productId);
        foreach (Guid id in picked)
        {
            if (!lookup.Options.TryGetValue(id, out ModifierOptionInfo? option) || !option.IsActive
                || !lookup.Groups.TryGetValue(option.GroupId, out ModifierGroupRules? group) || !group.IsActive)
            {
                return PosErrors.ModifierUnavailable(line.ProductName);
            }

            if (!hasProduct || !group.ProductIds.Contains(productId))
            {
                return PosErrors.ModifierNotForProduct(line.ProductName, option.Name);
            }
        }

        if (!hasProduct)
        {
            return Result.Success;
        }

        // Every pick is valid by now, so counting by group is safe.
        foreach (ModifierGroupRules group in lookup.Groups.Values.Where(g => g.IsActive && g.ProductIds.Contains(productId)))
        {
            int count = picked.Count(id => lookup.Options[id].GroupId == group.GroupId);
            if (count == 0 && group.IsRequired)
            {
                return PosErrors.ModifierRequired(line.ProductName, group.Name);
            }

            if (count < group.MinSelect || count > group.MaxSelect)
            {
                return PosErrors.ModifierSelection(line.ProductName, group.Name, group.MinSelect, group.MaxSelect);
            }
        }

        return Result.Success;
    }

    private static List<Guid> Picked(CheckoutOrderCommand.Line line) => [.. (line.ModifierOptionIds ?? []).Distinct()];

    private static IEnumerable<ModifierOptionInfo> Known(CheckoutOrderCommand.Line line, ModifierLookup lookup) =>
        Picked(line).Where(lookup.Options.ContainsKey).Select(id => lookup.Options[id]);
}
