using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Commands.CreateStockMaterial;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.RestoreStockMaterial;

internal sealed class RestoreStockMaterialCommandHandler(InventoryDbContext db)
    : ICommandHandler<RestoreStockMaterialCommand, StockMaterialResponse>
{
    public async Task<ErrorOr<StockMaterialResponse>> Handle(
        RestoreStockMaterialCommand request,
        CancellationToken cancellationToken)
    {
        StockMaterial? material = await db.StockMaterials
            .FirstOrDefaultAsync(m => m.Id == request.MaterialId && m.TenantId == request.TenantId, cancellationToken);

        if (material is null)
        {
            return Error.NotFound("Inventory.MaterialNotFound", "Stock material was not found.");
        }

        if (!material.IsActive)
        {
            material.Activate();
            await db.SaveChangesAsync(cancellationToken);
        }

        string? categoryName = material.CategoryId.HasValue
            ? await db.StockMaterialCategories
                .Where(c => c.Id == material.CategoryId)
                .Select(c => c.Name)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return CreateStockMaterialCommandHandler.ToResponse(material, categoryName);
    }
}
