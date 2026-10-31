namespace NexusPOS.Inventory.Application.Services;

// Reads variant cost prices (net of VAT) from the catalog tables in the tenant schema,
// so a stock count can value its snapshot without trusting numbers sent by the browser.
internal interface IVariantCostLookup
{
    // Variants that are missing from the catalog are left out of the result.
    Task<IReadOnlyDictionary<Guid, decimal>> GetCostsAsync(
        IReadOnlyCollection<Guid> variantIds,
        CancellationToken cancellationToken = default);
}
