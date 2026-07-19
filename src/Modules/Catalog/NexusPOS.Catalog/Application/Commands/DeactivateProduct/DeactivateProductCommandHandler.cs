using ErrorOr;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Catalog.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Application.Commands.DeactivateProduct;

internal sealed class DeactivateProductCommandHandler(
    IProductRepository productRepository,
    CatalogDbContext dbContext)
    : ICommandHandler<DeactivateProductCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        DeactivateProductCommand request,
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
            return Result.Success;
        }

        product.Deactivate();
        productRepository.Update(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
