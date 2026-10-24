using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Commands.CreateStockMaterial;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.UpdateStockMaterial;

internal sealed class UpdateStockMaterialCommandHandler(InventoryDbContext db)
    : ICommandHandler<UpdateStockMaterialCommand, StockMaterialResponse>
{
    public async Task<ErrorOr<StockMaterialResponse>> Handle(
        UpdateStockMaterialCommand request,
        CancellationToken cancellationToken)
    {
        StockMaterial? material = await db.StockMaterials
            .FirstOrDefaultAsync(m => m.Id == request.MaterialId && m.TenantId == request.TenantId, cancellationToken);

        if (material is null)
        {
            return Error.NotFound("Inventory.MaterialNotFound", "Stock material was not found.");
        }

        string newCode = request.Code.Trim().ToUpperInvariant();
        bool codeConflict = await db.StockMaterials
            .AnyAsync(m => m.TenantId == request.TenantId && m.Code == newCode && m.Id != request.MaterialId, cancellationToken);

        if (codeConflict)
        {
            return Error.Conflict("Inventory.MaterialCodeExists", "A stock material with this code already exists.");
        }

        material.Update(request.Code, request.NameAr, request.NameEn, request.CategoryId,
            request.StorageUnit, request.ComponentUnit, request.ConversionFactor,
            request.CostMethod, request.ManualCost, request.ManualQuantity, request.MinLevel, request.MaxLevel, request.ReorderLevel);

        await db.SaveChangesAsync(cancellationToken);

        string? categoryName = null;
        if (material.CategoryId.HasValue)
        {
            categoryName = await db.StockMaterialCategories
                .Where(c => c.Id == material.CategoryId)
                .Select(c => c.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return CreateStockMaterialCommandHandler.ToResponse(material, categoryName);
    }
}
