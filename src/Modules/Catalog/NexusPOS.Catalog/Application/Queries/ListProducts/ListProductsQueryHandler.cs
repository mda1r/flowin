using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.ListProducts;

internal sealed class ListProductsQueryHandler(IProductRepository productRepository)
    : IQueryHandler<ListProductsQuery, IReadOnlyList<ProductResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ProductResponse>>> Handle(
        ListProductsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Product> products = !string.IsNullOrWhiteSpace(request.Search)
            ? await productRepository.SearchAsync(request.Search, cancellationToken)
            : request.CategoryId.HasValue
                ? await productRepository.FindByCategoryAsync(new CategoryId(request.CategoryId.Value), cancellationToken)
                : await productRepository.FindAllActiveAsync(cancellationToken);

        IReadOnlyList<ProductResponse> responses = products.Select(MapToResponse).ToList();

        return ErrorOrFactory.From(responses);
    }

    private static ProductResponse MapToResponse(Product p) => new(
        p.Id.Value,
        p.Name,
        p.Description,
        p.CategoryId?.Value,
        p.Type,
        p.TaxClass,
        p.IsActive,
        p.TrackInventory,
        p.ImageUrl,
        p.CreatedAt,
        p.Variants.Select(v => new ProductVariantResponse(
            v.Id.Value, v.Sku.Value, v.Name,
            v.CostPrice.Amount, v.SalePrice.Amount, v.SalePrice.Currency,
            v.Barcode, v.IsActive, v.ExpiryDate)).ToList());
}
