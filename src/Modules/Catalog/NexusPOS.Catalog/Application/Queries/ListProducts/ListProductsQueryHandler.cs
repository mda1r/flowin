using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Application.Services;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.ListProducts;

internal sealed class ListProductsQueryHandler(IProductRepository productRepository, ProductModifierReader modifierReader)
    : IQueryHandler<ListProductsQuery, IReadOnlyList<ProductResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ProductResponse>>> Handle(
        ListProductsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Product> products = !string.IsNullOrWhiteSpace(request.Search)
            ? await productRepository.SearchAsync(request.Search, request.Limit, cancellationToken)
            : request.CategoryId.HasValue
                ? await productRepository.FindByCategoryAsync(new CategoryId(request.CategoryId.Value), request.Limit, cancellationToken)
                : await productRepository.FindAllActiveAsync(request.Limit, cancellationToken);

        IReadOnlyDictionary<Guid, IReadOnlyList<ProductModifierGroupResponse>> modifiers =
            await modifierReader.ForProductsAsync([.. products.Select(p => p.Id)], cancellationToken);
        IReadOnlyList<ProductResponse> responses =
            [.. products.Select(p => MapToResponse(p, ProductModifierReader.For(modifiers, p.Id.Value)))];

        return ErrorOrFactory.From(responses);
    }

    internal static ProductResponse MapToResponse(
        Product p, IReadOnlyList<ProductModifierGroupResponse>? modifierGroups = null) => new(
        p.Id.Value,
        p.Name,
        p.Description,
        p.CategoryId?.Value,
        p.Type,
        p.TaxClass,
        p.IsActive,
        p.TrackInventory,
        p.UnitType,
        p.ImageUrl,
        p.CreatedAt,
        p.Variants.Select(v => new ProductVariantResponse(
            v.Id.Value, v.Sku.Value, v.Name,
            v.CostPrice.Amount, v.SalePrice.Amount, v.SalePrice.Currency,
            v.Barcode, v.IsActive, v.ExpiryDate)).ToList(),
        modifierGroups);
}
