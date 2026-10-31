namespace NexusPOS.SharedKernel.Application.Services;

// Lets the cashier flow check line prices against the catalog without referencing the Catalog module.
public interface IVariantPriceDirectory
{
    // Listed sale price (VAT included) per variant id; ids that are not in the catalog are left out.
    Task<IReadOnlyDictionary<Guid, decimal>> GetSalePricesAsync(
        IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken = default);
}
