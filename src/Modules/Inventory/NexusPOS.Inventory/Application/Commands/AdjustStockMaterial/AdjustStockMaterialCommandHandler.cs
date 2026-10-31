using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Commands.CreateStockMaterial;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.Commands.AdjustStockMaterial;

// Sets a material's balance to a counted quantity, logging the difference with its reason.
internal sealed class AdjustStockMaterialCommandHandler(InventoryDbContext db, ITenantContext tenantContext)
    : ICommandHandler<AdjustStockMaterialCommand, StockMaterialResponse>
{
    public async Task<ErrorOr<StockMaterialResponse>> Handle(
        AdjustStockMaterialCommand request,
        CancellationToken cancellationToken)
    {
        StockMaterial? material = await db.StockMaterials
            .FirstOrDefaultAsync(m => m.Id == request.MaterialId && m.TenantId == request.TenantId && m.IsActive, cancellationToken);

        if (material is null)
        {
            return Error.NotFound("Inventory.MaterialNotFound", "Stock material was not found.");
        }

        decimal change = material.AdjustTo(request.NewQuantity);
        if (change != 0)
        {
            db.StockMaterialMovements.Add(StockMaterialMovement.Record(
                material, StockMaterialMovementType.Adjustment, change, null, request.Reason, tenantContext.UserId));
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
