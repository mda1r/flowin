using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.Catalog.Application.Services;

internal sealed class VariantPriceDirectory(CatalogDbContext db) : IVariantPriceDirectory
{
    public async Task<IReadOnlyDictionary<Guid, decimal>> GetSalePricesAsync(
        IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken = default)
    {
        if (variantIds.Count == 0)
        {
            return new Dictionary<Guid, decimal>();
        }

        List<VariantId> ids = [.. variantIds.Distinct().Select(id => new VariantId(id))];
        var prices = await db.ProductVariants
            .AsNoTracking()
            .Where(v => ids.Contains(v.Id))
            .Select(v => new { v.Id, v.SalePrice.Amount })
            .ToListAsync(cancellationToken);
        return prices.ToDictionary(p => p.Id.Value, p => p.Amount);
    }

    public async Task<IReadOnlyDictionary<Guid, decimal>> GetCostPricesAsync(
        IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken = default)
    {
        if (variantIds.Count == 0)
        {
            return new Dictionary<Guid, decimal>();
        }

        List<VariantId> ids = [.. variantIds.Distinct().Select(id => new VariantId(id))];
        var costs = await db.ProductVariants
            .AsNoTracking()
            .Where(v => ids.Contains(v.Id))
            .Select(v => new { v.Id, v.CostPrice.Amount })
            .ToListAsync(cancellationToken);
        return costs.ToDictionary(c => c.Id.Value, c => c.Amount);
    }

    public async Task<IReadOnlyDictionary<Guid, Guid>> GetProductIdsAsync(
        IReadOnlyCollection<Guid> variantIds, CancellationToken cancellationToken = default)
    {
        if (variantIds.Count == 0)
        {
            return new Dictionary<Guid, Guid>();
        }

        List<VariantId> ids = [.. variantIds.Distinct().Select(id => new VariantId(id))];
        var products = await db.ProductVariants
            .AsNoTracking()
            .Where(v => ids.Contains(v.Id))
            .Select(v => new { v.Id, v.ProductId })
            .ToListAsync(cancellationToken);
        return products.ToDictionary(p => p.Id.Value, p => p.ProductId.Value);
    }
}
