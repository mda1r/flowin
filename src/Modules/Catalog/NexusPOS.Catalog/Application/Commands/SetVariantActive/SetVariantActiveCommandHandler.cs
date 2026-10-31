using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.SetVariantActive;

internal sealed class SetVariantActiveCommandHandler(
    IProductRepository productRepository,
    CatalogDbContext dbContext)
    : ICommandHandler<SetVariantActiveCommand, ProductVariantResponse>
{
    public async Task<ErrorOr<ProductVariantResponse>> Handle(
        SetVariantActiveCommand request,
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
            return CatalogErrors.VariantNotFound;
        }

        // Reactivating must not bring back a barcode that another active variant took over meanwhile.
        if (request.IsActive && !variant.IsActive && variant.Barcode is not null &&
            await productRepository.IsBarcodeTakenAsync(variant.Barcode, variantId, cancellationToken))
        {
            return CatalogErrors.BarcodeAlreadyExists;
        }

        ErrorOr<Success> result = product.SetVariantActive(variantId, request.IsActive);
        if (result.IsError)
        {
            return result.Errors;
        }

        productRepository.Update(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ProductVariantResponse(
            variant.Id.Value, variant.Sku.Value, variant.Name,
            variant.CostPrice.Amount, variant.SalePrice.Amount, variant.SalePrice.Currency,
            variant.Barcode, variant.IsActive, variant.ExpiryDate);
    }
}
