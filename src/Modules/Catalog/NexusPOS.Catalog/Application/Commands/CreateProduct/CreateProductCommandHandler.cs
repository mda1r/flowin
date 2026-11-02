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

        // Scans match on barcode or SKU, so a SKU may not equal another active variant's barcode either.
        bool skuExists = await productRepository.ExistsBySkuAsync(skuResult.Value.Value, cancellationToken) ||
            await productRepository.IsBarcodeTakenAsync(skuResult.Value.Value, cancellationToken: cancellationToken);
        if (skuExists)
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
            request.TrackInventory,
            request.UnitType);
        product.SetNameEn(request.NameEn);

        ErrorOr<ProductVariant> variantResult = product.AddVariant(
            skuResult.Value,
            request.VariantName,
            costResult.Value,
            salePriceResult.Value,
            barcode,
            request.ExpiryDate);

        if (variantResult.IsError)
        {
            return variantResult.Errors;
        }

        product.SetVariantNameEn(variantResult.Value.Id, request.VariantNameEn);

        productRepository.Add(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ProductMapper.ToResponse(product);
    }
}
