using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Application.Queries.ListProducts;
using NexusPOS.Catalog.Application.Services;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.GetProductById;

internal sealed class GetProductByIdQueryHandler(IProductRepository productRepository, ProductModifierReader modifierReader)
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

        IReadOnlyDictionary<Guid, IReadOnlyList<ProductModifierGroupResponse>> modifiers =
            await modifierReader.ForProductsAsync([product.Id], cancellationToken);
        return ListProductsQueryHandler.MapToResponse(product, ProductModifierReader.For(modifiers, product.Id.Value));
    }
}
