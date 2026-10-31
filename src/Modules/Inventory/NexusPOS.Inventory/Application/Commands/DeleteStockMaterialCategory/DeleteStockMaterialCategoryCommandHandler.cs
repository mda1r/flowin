using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.DeleteStockMaterialCategory;

internal sealed class DeleteStockMaterialCategoryCommandHandler(InventoryDbContext db)
    : ICommandHandler<DeleteStockMaterialCategoryCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        DeleteStockMaterialCategoryCommand request,
        CancellationToken cancellationToken)
    {
        StockMaterialCategory? category = await db.StockMaterialCategories
            .FirstOrDefaultAsync(c => c.Id == request.CategoryId && c.TenantId == request.TenantId, cancellationToken);

        if (category is null)
        {
            return Error.NotFound("Inventory.CategoryNotFound", "Stock material category was not found.");
        }

        bool hasItems = await db.StockMaterials
            .AnyAsync(m => m.CategoryId == request.CategoryId, cancellationToken);

        if (hasItems)
        {
            return Error.Conflict("Inventory.CategoryHasItems", "Cannot delete category that has stock materials.");
        }

        db.StockMaterialCategories.Remove(category);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
