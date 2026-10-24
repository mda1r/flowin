using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Commands.CreateStockMaterial;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetStockMaterial;

internal sealed class GetStockMaterialQueryHandler(InventoryDbContext db)
    : IQueryHandler<GetStockMaterialQuery, StockMaterialResponse>
{
    public async Task<ErrorOr<StockMaterialResponse>> Handle(
        GetStockMaterialQuery request,
        CancellationToken cancellationToken)
    {
        StockMaterial? material = await db.StockMaterials
            .FirstOrDefaultAsync(m => m.Id == request.MaterialId && m.TenantId == request.TenantId, cancellationToken);

        if (material is null)
        {
            return Error.NotFound("Inventory.MaterialNotFound", "Stock material was not found.");
        }

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
