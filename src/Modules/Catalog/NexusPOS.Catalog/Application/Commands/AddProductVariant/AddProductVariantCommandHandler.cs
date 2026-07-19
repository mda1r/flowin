using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Catalog.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Application.Commands.AddProductVariant;

internal sealed class AddProductVariantCommandHandler(
    IProductRepository productRepository,
    CatalogDbContext dbContext)
    : ICommandHandler<AddProductVariantCommand, ProductVariantResponse>
{
    public async Task<ErrorOr<ProductVariantResponse>> Handle(
        AddProductVariantCommand request,
        CancellationToken cancellationToken)
    {
        Product? product = await productRepository.FindByIdAsync(
            new ProductId(request.ProductId), cancellationToken);

        if (product is null)
        {
            return CatalogErrors.ProductNotFound;
        }

        if (!product.IsActive)
        {
            return CatalogErrors.ProductInactive;
        }

        ErrorOr<Sku> skuResult = Sku.Create(request.Sku);
        if (skuResult.IsError)
        {
            return skuResult.Errors;
        }

        ErrorOr<Money> costResult = Money.Create(request.CostPrice, request.Currency);
        if (costResult.IsError)
        {
            return costResult.Errors;
        }

        ErrorOr<Money> saleResult = Money.Create(request.SalePrice, request.Currency);
        if (saleResult.IsError)
        {
            return saleResult.Errors;
        }

        ErrorOr<ProductVariant> variantResult = product.AddVariant(
            skuResult.Value, request.Name, costResult.Value, saleResult.Value, request.Barcode, request.ExpiryDate);

        if (variantResult.IsError)
        {
            return variantResult.Errors;
        }

        productRepository.Update(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        ProductVariant v = variantResult.Value;
        return new ProductVariantResponse(
            v.Id.Value, v.Sku.Value, v.Name,
            v.CostPrice.Amount, v.SalePrice.Amount, v.SalePrice.Currency,
            v.Barcode, v.IsActive, v.ExpiryDate);
    }
}
