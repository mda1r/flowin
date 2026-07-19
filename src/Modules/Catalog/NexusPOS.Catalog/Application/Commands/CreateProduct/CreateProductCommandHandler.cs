using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Catalog.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Application.Commands.CreateProduct;

internal sealed class CreateProductCommandHandler(
    IProductRepository productRepository,
    CatalogDbContext dbContext)
    : ICommandHandler<CreateProductCommand, ProductResponse>
{
    public async Task<ErrorOr<ProductResponse>> Handle(
        CreateProductCommand request,
        CancellationToken cancellationToken)
    {
        ErrorOr<Sku> skuResult = Sku.Create(request.Sku);
        if (skuResult.IsError)
        {
            return skuResult.Errors;
        }

        bool skuExists = await productRepository.ExistsBySkuAsync(skuResult.Value.Value, cancellationToken);
        if (skuExists)
        {
            return CatalogErrors.SkuAlreadyExists;
        }

        ErrorOr<Money> costResult = Money.Create(request.CostPrice, request.Currency);
        if (costResult.IsError)
        {
            return costResult.Errors;
        }

        ErrorOr<Money> salePriceResult = Money.Create(request.SalePrice, request.Currency);
        if (salePriceResult.IsError)
        {
            return salePriceResult.Errors;
        }

        CategoryId? categoryId = request.CategoryId.HasValue
            ? new CategoryId(request.CategoryId.Value)
            : null;

        Product product = Product.Create(
            request.Name,
            request.Description,
            categoryId,
            request.Type,
            request.TaxClass,
            request.TrackInventory);

        ErrorOr<ProductVariant> variantResult = product.AddVariant(
            skuResult.Value,
            request.VariantName,
            costResult.Value,
            salePriceResult.Value,
            request.Barcode,
            request.ExpiryDate);

        if (variantResult.IsError)
        {
            return variantResult.Errors;
        }

        productRepository.Add(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(product);
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
