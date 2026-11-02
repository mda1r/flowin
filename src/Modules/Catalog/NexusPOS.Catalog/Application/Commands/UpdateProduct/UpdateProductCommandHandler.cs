using ErrorOr;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.UpdateProduct;

internal sealed class UpdateProductCommandHandler(
    IProductRepository productRepository,
    CatalogDbContext dbContext)
    : ICommandHandler<UpdateProductCommand, ProductResponse>
{
    public async Task<ErrorOr<ProductResponse>> Handle(
        UpdateProductCommand request,
        CancellationToken cancellationToken)
    {
        Product? product = await productRepository.FindByIdAsync(
            new ProductId(request.ProductId), cancellationToken);

        if (product is null)
        {
            return CatalogErrors.ProductNotFound;
        }

        CategoryId? categoryId = request.CategoryId.HasValue
            ? new CategoryId(request.CategoryId.Value)
            : null;

        product.Update(request.Name, request.Description, categoryId, request.TaxClass, request.TrackInventory, request.ImageUrl, request.UnitType);
        if (request.NameEn is not null)
        {
            product.SetNameEn(request.NameEn);
        }

        productRepository.Update(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ProductMapper.ToResponse(product);
    }
}
