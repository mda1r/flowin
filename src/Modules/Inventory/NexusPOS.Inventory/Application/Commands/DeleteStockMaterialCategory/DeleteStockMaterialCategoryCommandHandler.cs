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
            return Error.NotFound("Inventory.CategoryNotFound", "التصنيف غير موجود");
        }

        bool hasItems = await db.StockMaterials
            .AnyAsync(m => m.CategoryId == request.CategoryId, cancellationToken);

        if (hasItems)
        {
            return Error.Conflict("Inventory.CategoryHasItems", "لا يمكن حذف تصنيف يحتوي على مواد، انقل المواد أو احذفها أولاً");
        }

        db.StockMaterialCategories.Remove(category);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
