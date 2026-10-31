using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Application.Queries.ListProducts;
using NexusPOS.Catalog.Application.Services;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.GetProductByBarcode;

internal sealed class GetProductByBarcodeQueryHandler(IProductRepository productRepository, ProductModifierReader modifierReader)
    : IQueryHandler<GetProductByBarcodeQuery, ProductResponse>
{
    public async Task<ErrorOr<ProductResponse>> Handle(GetProductByBarcodeQuery request, CancellationToken cancellationToken)
    {
        string code = request.Code.Trim();
        if (code.Length == 0)
        {
            return CatalogErrors.ProductNotFound;
        }

        Product? product = await productRepository.FindByBarcodeAsync(code, cancellationToken);
        if (product is null)
        {
            return CatalogErrors.ProductNotFound;
        }

        IReadOnlyDictionary<Guid, IReadOnlyList<ProductModifierGroupResponse>> modifiers =
            await modifierReader.ForProductsAsync([product.Id], cancellationToken);
        return ListProductsQueryHandler.MapToResponse(product, ProductModifierReader.For(modifiers, product.Id.Value));
    }
}
