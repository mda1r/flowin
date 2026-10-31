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

        ProductVariant? variant = product.Variants
            .FirstOrDefault(v => v.Id == new VariantId(request.VariantId));

        if (variant is null)
        {
            return Error.NotFound("Variant.NotFound", "النوع غير موجود");
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

        productRepository.Update(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ProductVariantResponse(
            variant.Id.Value, variant.Sku.Value, variant.Name,
            variant.CostPrice.Amount, variant.SalePrice.Amount, variant.SalePrice.Currency,
            variant.Barcode, variant.IsActive, variant.ExpiryDate);
    }
}
