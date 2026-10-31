using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Domain.Repositories;

public interface IProductRepository
{
    Task<Product?> FindByIdAsync(ProductId id, CancellationToken cancellationToken = default);
    Task<bool> ExistsBySkuAsync(string sku, CancellationToken cancellationToken = default);

    // True when another variant (other than excludeVariantId) already owns this SKU.
    Task<bool> ExistsBySkuAsync(string sku, VariantId excludeVariantId, CancellationToken cancellationToken = default);

    // True when an active variant (other than excludeVariantId) would answer a scan of this code, by barcode or SKU.
    Task<bool> IsBarcodeTakenAsync(string barcode, VariantId? excludeVariantId = null, CancellationToken cancellationToken = default);
    // take caps the result (ordered by name) when given; null returns every match.
    Task<IReadOnlyList<Product>> FindAllActiveAsync(int? take = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Product>> FindByCategoryAsync(CategoryId categoryId, int? take = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Product>> SearchAsync(string search, int? take = null, CancellationToken cancellationToken = default);
    Task<Product?> FindByBarcodeAsync(string barcode, CancellationToken cancellationToken = default);
    void Add(Product product);
    void Update(Product product);
}
