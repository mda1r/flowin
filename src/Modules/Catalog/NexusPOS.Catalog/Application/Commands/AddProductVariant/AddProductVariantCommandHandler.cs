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

        // SKUs are unique across the whole catalog (ix_product_variants_sku), not just within this product,
        // and may not equal another active variant's barcode since scans match on either.
        if (await productRepository.ExistsBySkuAsync(skuResult.Value.Value, cancellationToken) ||
            await productRepository.IsBarcodeTakenAsync(skuResult.Value.Value, cancellationToken: cancellationToken))
        {
            return CatalogErrors.SkuAlreadyExists;
        }

        string? barcode = ProductVariant.NormalizeBarcode(request.Barcode);
        if (barcode is not null && await productRepository.IsBarcodeTakenAsync(barcode, cancellationToken: cancellationToken))
        {
            return CatalogErrors.BarcodeAlreadyExists;
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
            skuResult.Value, request.Name, costResult.Value, saleResult.Value, barcode, request.ExpiryDate);

        if (variantResult.IsError)
        {
            return variantResult.Errors;
        }

        product.SetVariantNameEn(variantResult.Value.Id, request.NameEn);
        productRepository.Update(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ProductMapper.ToResponse(variantResult.Value);
    }
}
