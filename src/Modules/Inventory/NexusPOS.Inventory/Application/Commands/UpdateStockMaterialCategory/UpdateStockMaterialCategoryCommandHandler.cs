using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.UpdateStockMaterialCategory;

internal sealed class UpdateStockMaterialCategoryCommandHandler(InventoryDbContext db)
    : ICommandHandler<UpdateStockMaterialCategoryCommand, StockMaterialCategoryResponse>
{
    public async Task<ErrorOr<StockMaterialCategoryResponse>> Handle(
        UpdateStockMaterialCategoryCommand request,
        CancellationToken cancellationToken)
    {
        StockMaterialCategory? category = await db.StockMaterialCategories
            .FirstOrDefaultAsync(c => c.Id == request.CategoryId && c.TenantId == request.TenantId, cancellationToken);

        if (category is null)
        {
            return Error.NotFound("Inventory.CategoryNotFound", "Stock material category was not found.");
        }

        category.Update(request.Name);
        await db.SaveChangesAsync(cancellationToken);

        return new StockMaterialCategoryResponse(category.Id, category.Name, category.IsActive);
    }
}
