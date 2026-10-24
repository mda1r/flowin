using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.DeleteStockMaterial;

internal sealed class DeleteStockMaterialCommandHandler(InventoryDbContext db)
    : ICommandHandler<DeleteStockMaterialCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        DeleteStockMaterialCommand request,
        CancellationToken cancellationToken)
    {
        StockMaterial? material = await db.StockMaterials
            .FirstOrDefaultAsync(m => m.Id == request.MaterialId && m.TenantId == request.TenantId, cancellationToken);

        if (material is null)
        {
            return Error.NotFound("Inventory.MaterialNotFound", "Stock material was not found.");
        }

        int recipeUses = await db.RecipeLines
            .Where(r => r.TenantId == request.TenantId && r.MaterialId == material.Id)
            .Select(r => r.VariantId)
            .Distinct()
            .CountAsync(cancellationToken);
        if (recipeUses > 0)
        {
            return Error.Conflict(
                "Inventory.MaterialUsedInRecipes",
                $"لا يمكن حذف المادة لأنها مستخدمة في وصفة {recipeUses} منتج. احذفها من الوصفات أولاً.");
        }

        db.StockMaterials.Remove(material);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
