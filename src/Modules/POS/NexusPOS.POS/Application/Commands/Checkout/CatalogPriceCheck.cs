using ErrorOr;
using NexusPOS.POS.Domain;

namespace NexusPOS.POS.Application.Commands.Checkout;

// A cashier charges at least the catalogue price; any reduction has to go through the capped discount.
internal static class CatalogPriceCheck
{
    // The till sends the pre-VAT price rounded to four places, so allow a halala of rounding per unit.
    private const decimal Tolerance = 0.01m;

    public static ErrorOr<Success> Check(CheckoutOrderCommand cmd, IReadOnlyDictionary<Guid, decimal> shelfPrices)
    {
        foreach (CheckoutOrderCommand.Line line in cmd.Lines)
        {
            if (!shelfPrices.TryGetValue(line.VariantId, out decimal shelf))
            {
                return PosErrors.UnknownProduct(line.ProductName);
            }

            if (line.UnitPrice * (1 + cmd.TaxRate) < shelf - Tolerance)
            {
                return PosErrors.PriceBelowCatalog(line.ProductName);
            }
        }

        return Result.Success;
    }

    // For a sale already made offline: the lines that would not pass Check, by name, for the manager to review.
    public static List<string> Unverified(CheckoutOrderCommand cmd, IReadOnlyDictionary<Guid, decimal> shelfPrices) =>
        [.. cmd.Lines.Where(l => Check(cmd with { Lines = [l] }, shelfPrices).IsError).Select(l => l.ProductName)];
}
