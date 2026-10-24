using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CreateStockMaterial;

internal sealed class CreateStockMaterialCommandHandler(InventoryDbContext db)
    : ICommandHandler<CreateStockMaterialCommand, StockMaterialResponse>
{
    public async Task<ErrorOr<StockMaterialResponse>> Handle(
        CreateStockMaterialCommand request,
        CancellationToken cancellationToken)
    {
        string upperCode = request.Code.Trim().ToUpperInvariant();
        bool codeExists = await db.StockMaterials
            .AnyAsync(m => m.TenantId == request.TenantId && m.Code == upperCode, cancellationToken);

        if (codeExists)
        {
            return Error.Conflict("Inventory.MaterialCodeExists", "A stock material with this code already exists.");
        }

        StockMaterial material = StockMaterial.Create(
            request.TenantId, request.Code, request.NameAr, request.NameEn,
            request.CategoryId, request.StorageUnit, request.ComponentUnit,
            request.ConversionFactor, request.CostMethod, request.InitialCost,
            request.InitialQuantity, request.MinLevel, request.MaxLevel, request.ReorderLevel);

        db.StockMaterials.Add(material);
        await db.SaveChangesAsync(cancellationToken);

        string? categoryName = null;
        if (material.CategoryId.HasValue)
        {
            categoryName = await db.StockMaterialCategories
                .Where(c => c.Id == material.CategoryId)
                .Select(c => c.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return ToResponse(material, categoryName);
    }

    internal static StockMaterialResponse ToResponse(StockMaterial m, string? categoryName) =>
        new(m.Id, m.Code, m.NameAr, m.NameEn, m.CategoryId, categoryName,
            m.StorageUnit, m.ComponentUnit, m.ConversionFactor,
            m.CostMethod.ToString(), m.CurrentCost, m.CurrentQuantityInStorageUnits,
            m.MinLevel, m.MaxLevel, m.ReorderLevel, m.IsActive, m.IsLowStock);
}
