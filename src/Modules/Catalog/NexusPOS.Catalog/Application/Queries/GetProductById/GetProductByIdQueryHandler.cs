using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.GetProductById;

internal sealed class GetProductByIdQueryHandler(IProductRepository productRepository)
    : IQueryHandler<GetProductByIdQuery, ProductResponse>
{
    public async Task<ErrorOr<ProductResponse>> Handle(
        GetProductByIdQuery request,
        CancellationToken cancellationToken)
    {
        Product? product = await productRepository.FindByIdAsync(
            new ProductId(request.ProductId), cancellationToken);

        if (product is null)
        {
            return CatalogErrors.ProductNotFound;
        }

        return new ProductResponse(
            product.Id.Value,
            product.Name,
            product.Description,
            product.CategoryId?.Value,
            product.Type,
            product.TaxClass,
            product.IsActive,
            product.TrackInventory,
            product.ImageUrl,
            product.CreatedAt,
            product.Variants.Select(v => new ProductVariantResponse(
                v.Id.Value, v.Sku.Value, v.Name,
                v.CostPrice.Amount, v.SalePrice.Amount, v.SalePrice.Currency,
                v.Barcode, v.IsActive, v.ExpiryDate)).ToList());
    }
}
