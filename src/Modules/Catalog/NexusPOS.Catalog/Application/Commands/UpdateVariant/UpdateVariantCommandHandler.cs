using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.UpdateVariant;

internal sealed class UpdateVariantCommandHandler(
    IProductRepository productRepository,
    CatalogDbContext dbContext)
    : ICommandHandler<UpdateVariantCommand, ProductVariantResponse>
{
    public async Task<ErrorOr<ProductVariantResponse>> Handle(
        UpdateVariantCommand request,
        CancellationToken cancellationToken)
    {
        Product? product = await productRepository.FindByIdAsync(
            new ProductId(request.ProductId), cancellationToken);

        if (product is null)
        {
            return CatalogErrors.ProductNotFound;
        }

        VariantId variantId = new(request.VariantId);
        ProductVariant? variant = product.Variants.FirstOrDefault(v => v.Id == variantId);

        if (variant is null)
        {
            return Error.NotFound("Variant.NotFound", "النوع غير موجود");
        }

        // A null SKU or barcode keeps the stored value; only a changed value is checked for clashes.
        Sku? newSku = null;
        if (request.Sku is not null)
        {
            ErrorOr<Sku> skuResult = Sku.Create(request.Sku);
            if (skuResult.IsError)
            {
                return skuResult.Errors;
            }

            if (skuResult.Value.Value != variant.Sku.Value)
            {
                if (await productRepository.ExistsBySkuAsync(skuResult.Value.Value, variantId, cancellationToken))
                {
                    return CatalogErrors.SkuAlreadyExists;
                }

                newSku = skuResult.Value;
            }
        }

        string? barcode = ProductVariant.NormalizeBarcode(request.Barcode);
        if (barcode is not null && barcode != variant.Barcode &&
            await productRepository.IsBarcodeTakenAsync(barcode, variantId, cancellationToken))
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

        variant.UpdatePricing(costResult.Value, saleResult.Value);
        variant.UpdateDetails(request.Name, request.Barcode);
        if (newSku is not null)
        {
            variant.ChangeSku(newSku);
        }

        productRepository.Update(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ProductVariantResponse(
            variant.Id.Value, variant.Sku.Value, variant.Name,
            variant.CostPrice.Amount, variant.SalePrice.Amount, variant.SalePrice.Currency,
            variant.Barcode, variant.IsActive, variant.ExpiryDate);
    }
}
