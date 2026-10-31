using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Infrastructure.Persistence.Repositories;

internal sealed class ProductRepository(CatalogDbContext dbContext) : IProductRepository
{
    public async Task<Product?> FindByIdAsync(ProductId id, CancellationToken cancellationToken = default) =>
        await dbContext.Products
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public async Task<bool> ExistsBySkuAsync(string sku, CancellationToken cancellationToken = default) =>
        await dbContext.ProductVariants
            .AnyAsync(v => v.Sku.Value == sku, cancellationToken);

    public async Task<bool> ExistsBySkuAsync(
        string sku, VariantId excludeVariantId, CancellationToken cancellationToken = default) =>
        await dbContext.ProductVariants
            .AnyAsync(v => v.Sku.Value == sku && v.Id != excludeVariantId, cancellationToken);

    public async Task<bool> IsBarcodeTakenAsync(
        string barcode, VariantId? excludeVariantId = null, CancellationToken cancellationToken = default)
    {
        IQueryable<ProductVariant> query = dbContext.ProductVariants
            .Where(v => v.IsActive && (v.Barcode == barcode || v.Sku.Value == barcode));

        if (excludeVariantId is not null)
        {
            query = query.Where(v => v.Id != excludeVariantId);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Product>> FindAllActiveAsync(int? take = null, CancellationToken cancellationToken = default) =>
        await Limit(dbContext.Products
            .Include(p => p.Variants)
            .Where(p => p.IsActive)
            .OrderBy(p => p.Name), take)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Product>> FindByCategoryAsync(
        CategoryId categoryId, int? take = null, CancellationToken cancellationToken = default) =>
        await Limit(dbContext.Products
            .Include(p => p.Variants)
            .Where(p => p.CategoryId == categoryId && p.IsActive)
            .OrderBy(p => p.Name), take)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Product>> SearchAsync(
        string search, int? take = null, CancellationToken cancellationToken = default) =>
        await Limit(dbContext.Products
            .Include(p => p.Variants)
            .Where(p => p.IsActive &&
                (p.Name.Contains(search) ||
                 p.Variants.Any(v => v.Sku.Value.Contains(search) ||
                                     v.Barcode != null && v.Barcode.Contains(search))))
            .OrderBy(p => p.Name), take)
            .ToListAsync(cancellationToken);

    // Exact match only: an active product with an active variant whose barcode or SKU is the scanned code.
    public async Task<Product?> FindByBarcodeAsync(
        string barcode, CancellationToken cancellationToken = default) =>
        await dbContext.Products
            .Include(p => p.Variants)
            .OrderBy(p => p.Name)
            .FirstOrDefaultAsync(p => p.IsActive &&
                p.Variants.Any(v => v.IsActive && (v.Barcode == barcode || v.Sku.Value == barcode)),
                cancellationToken);

    // The id tie-break keeps a capped page stable when two products share a name.
    private static IQueryable<Product> Limit(IOrderedQueryable<Product> query, int? take) =>
        take is int n ? query.ThenBy(p => p.Id).Take(n) : query;

    public void Add(Product product) => dbContext.Products.Add(product);

    public void Update(Product product) => dbContext.Products.Update(product);
}
