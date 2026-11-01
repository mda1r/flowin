namespace NexusPOS.SharedKernel.Application.Services;

// Lets the till check a sale's prices against the catalogue without referencing the Catalog module.
public interface IVariantPriceDirectory
{
    // Shelf price (VAT included) for each variant id that exists in the tenant's catalogue; unknown ids are left out.
    Task<IReadOnlyDictionary<Guid, decimal>> GetSalePricesAsync(
        IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken = default);

    // Catalogue cost price (net of VAT) for each variant id that exists in the tenant's catalogue; unknown ids are left out.
    Task<IReadOnlyDictionary<Guid, decimal>> GetCostPricesAsync(
        IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken = default);

    // The product each variant id belongs to in the tenant's catalogue, so checkout can match a drink's add-ons
    // to the groups attached to it; unknown ids are left out.
    Task<IReadOnlyDictionary<Guid, Guid>> GetProductIdsAsync(
        IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken = default);
}
