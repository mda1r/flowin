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

    public async Task<IReadOnlyList<Product>> FindAllActiveAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Products
            .Include(p => p.Variants)
            .Where(p => p.IsActive)
            .OrderBy(p => p.Name)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Product>> FindByCategoryAsync(
        CategoryId categoryId, CancellationToken cancellationToken = default) =>
        await dbContext.Products
            .Include(p => p.Variants)
            .Where(p => p.CategoryId == categoryId && p.IsActive)
            .OrderBy(p => p.Name)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Product>> SearchAsync(
        string search, CancellationToken cancellationToken = default) =>
        await dbContext.Products
            .Include(p => p.Variants)
            .Where(p => p.IsActive &&
                (p.Name.Contains(search) ||
                 p.Variants.Any(v => v.Sku.Value.Contains(search) ||
                                     v.Barcode != null && v.Barcode.Contains(search))))
            .OrderBy(p => p.Name)
            .ToListAsync(cancellationToken);

    public async Task<Product?> FindByBarcodeAsync(
        string barcode, CancellationToken cancellationToken = default) =>
        await dbContext.Products
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.IsActive &&
                p.Variants.Any(v => v.Barcode == barcode || v.Sku.Value == barcode),
                cancellationToken);

    public void Add(Product product) => dbContext.Products.Add(product);

    public void Update(Product product) => dbContext.Products.Update(product);
}
