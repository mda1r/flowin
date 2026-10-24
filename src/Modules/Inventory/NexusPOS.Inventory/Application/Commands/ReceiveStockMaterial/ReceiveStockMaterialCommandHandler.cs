using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Commands.CreateStockMaterial;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.Commands.ReceiveStockMaterial;

internal sealed class ReceiveStockMaterialCommandHandler(InventoryDbContext db, ITenantContext tenantContext)
    : ICommandHandler<ReceiveStockMaterialCommand, StockMaterialResponse>
{
    public async Task<ErrorOr<StockMaterialResponse>> Handle(
        ReceiveStockMaterialCommand request,
        CancellationToken cancellationToken)
    {
        StockMaterial? material = await db.StockMaterials
            .FirstOrDefaultAsync(m => m.Id == request.MaterialId && m.TenantId == request.TenantId, cancellationToken);

        if (material is null)
        {
            return Error.NotFound("Inventory.MaterialNotFound", "Stock material was not found.");
        }

        material.Receive(request.Quantity, request.UnitCost);
        db.StockMaterialMovements.Add(StockMaterialMovement.Record(
            material, StockMaterialMovementType.Receive, request.Quantity, request.UnitCost,
            request.Note, tenantContext.UserId));

        await db.SaveChangesAsync(cancellationToken);

        string? categoryName = material.CategoryId.HasValue
            ? await db.StockMaterialCategories
                .Where(c => c.Id == material.CategoryId)
                .Select(c => c.Name)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return CreateStockMaterialCommandHandler.ToResponse(material, categoryName);
    }
}
