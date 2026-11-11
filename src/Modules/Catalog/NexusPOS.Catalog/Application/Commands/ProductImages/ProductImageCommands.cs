using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Application.Commands.ProductImages;

/// <summary>Sets (or replaces) a product's photo. The bytes are checked to be a JPEG, PNG or WebP.</summary>
public sealed record SetProductImageCommand(Guid ProductId, byte[] Data) : ICommand<ProductResponse>;

/// <summary>Removes a product's photo; the till falls back to the product's initial.</summary>
public sealed record RemoveProductImageCommand(Guid ProductId) : ICommand<ProductResponse>;

internal sealed class SetProductImageCommandHandler(
    IProductRepository products,
    CatalogDbContext catalog,
    CatalogMediaDbContext media,
    ITenantContext tenantContext)
    : ICommandHandler<SetProductImageCommand, ProductResponse>
{
    public async Task<ErrorOr<ProductResponse>> Handle(SetProductImageCommand request, CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Error.Unauthorized("Catalog.NoTenant", "لا يوجد متجر في الجلسة");
        }

        if (request.Data.Length is 0 or > ProductImage.MaxBytes)
        {
            return CatalogErrors.ImageTooLarge;
        }

        string? contentType = ProductImage.SniffContentType(request.Data);
        if (contentType is null)
        {
            return CatalogErrors.ImageNotSupported;
        }

        // Read through the tenant's own catalogue: another shop's product id is simply not found.
        Product? product = await products.FindByIdAsync(new ProductId(request.ProductId), cancellationToken);
        if (product is null)
        {
            return CatalogErrors.ProductNotFound;
        }

        await media.ProductImages
            .Where(i => i.TenantId == tenantId && i.ProductId == request.ProductId)
            .ExecuteDeleteAsync(cancellationToken);
        ProductImage image = ProductImage.Create(tenantId, request.ProductId, contentType, request.Data);
        media.ProductImages.Add(image);
        await media.SaveChangesAsync(cancellationToken);

        product.SetImageUrl(ProductImage.UrlFor(image.Id));
        products.Update(product);
        await catalog.SaveChangesAsync(cancellationToken);
        return ProductMapper.ToResponse(product);
    }
}

internal sealed class RemoveProductImageCommandHandler(
    IProductRepository products,
    CatalogDbContext catalog,
    CatalogMediaDbContext media,
    ITenantContext tenantContext)
    : ICommandHandler<RemoveProductImageCommand, ProductResponse>
{
    public async Task<ErrorOr<ProductResponse>> Handle(RemoveProductImageCommand request, CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Error.Unauthorized("Catalog.NoTenant", "لا يوجد متجر في الجلسة");
        }

        Product? product = await products.FindByIdAsync(new ProductId(request.ProductId), cancellationToken);
        if (product is null)
        {
            return CatalogErrors.ProductNotFound;
        }

        await media.ProductImages
            .Where(i => i.TenantId == tenantId && i.ProductId == request.ProductId)
            .ExecuteDeleteAsync(cancellationToken);
        product.SetImageUrl(null);
        products.Update(product);
        await catalog.SaveChangesAsync(cancellationToken);
        return ProductMapper.ToResponse(product);
    }
}
