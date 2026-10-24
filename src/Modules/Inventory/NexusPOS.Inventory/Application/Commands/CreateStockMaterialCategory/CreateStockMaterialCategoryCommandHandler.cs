using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CreateStockMaterialCategory;

internal sealed class CreateStockMaterialCategoryCommandHandler(InventoryDbContext db)
    : ICommandHandler<CreateStockMaterialCategoryCommand, StockMaterialCategoryResponse>
{
    public async Task<ErrorOr<StockMaterialCategoryResponse>> Handle(
        CreateStockMaterialCategoryCommand request,
        CancellationToken cancellationToken)
    {
        bool exists = await db.StockMaterialCategories
            .AnyAsync(c => c.TenantId == request.TenantId && c.Name == request.Name.Trim(), cancellationToken);

        if (exists)
        {
            return Error.Conflict("Inventory.CategoryNameExists", "A category with this name already exists.");
        }

        StockMaterialCategory category = StockMaterialCategory.Create(request.TenantId, request.Name);
        db.StockMaterialCategories.Add(category);
        await db.SaveChangesAsync(cancellationToken);

        return new StockMaterialCategoryResponse(category.Id, category.Name, category.IsActive);
    }
}
