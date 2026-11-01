using ErrorOr;
using NexusPOS.POS.Domain;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.POS.Application.Commands.Checkout;

// A cashier charges at least the catalogue price; any reduction has to go through the capped discount.
// The catalogue price of a line is its size plus the add-ons picked with it.
internal static class CatalogPriceCheck
{
    // The till sends the pre-VAT price rounded to four places, so allow a halala of rounding per unit, and one more
    // for each add-on, since the till rounds each add-on price it shows to a halala.
    private const decimal Tolerance = 0.01m;

    public static ErrorOr<Success> Check(
        CheckoutOrderCommand cmd, IReadOnlyDictionary<Guid, decimal> shelfPrices, ModifierLookup? modifiers = null)
    {
        foreach (CheckoutOrderCommand.Line line in cmd.Lines)
        {
            if (!shelfPrices.TryGetValue(line.VariantId, out decimal shelf))
            {
                return PosErrors.UnknownProduct(line.ProductName);
            }

            // Shelf prices include VAT and add-on prices are net, so the add-ons take VAT on before they are compared.
            decimal addOns = modifiers is null ? 0m : ModifierCheck.Deltas(line, modifiers);
            int addOnCount = modifiers is null ? 0 : ModifierCheck.KnownCount(line, modifiers);
            decimal expected = shelf + (addOns * (1 + cmd.TaxRate));
            if (line.UnitPrice * (1 + cmd.TaxRate) < expected - (Tolerance * (1 + addOnCount)))
            {
                return PosErrors.PriceBelowCatalog(line.ProductName);
            }
        }

        return Result.Success;
    }

    // For a sale already made offline: the lines that would not pass Check, by name, for the manager to review.
    public static List<string> Unverified(
        CheckoutOrderCommand cmd, IReadOnlyDictionary<Guid, decimal> shelfPrices, ModifierLookup? modifiers = null) =>
        [.. cmd.Lines.Where(l => Check(cmd with { Lines = [l] }, shelfPrices, modifiers).IsError).Select(l => l.ProductName)];
}
