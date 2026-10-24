using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockMaterialCategories;

internal sealed class ListStockMaterialCategoriesQueryHandler(InventoryDbContext db)
    : IQueryHandler<ListStockMaterialCategoriesQuery, IReadOnlyList<StockMaterialCategoryResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<StockMaterialCategoryResponse>>> Handle(
        ListStockMaterialCategoriesQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<StockMaterialCategoryResponse> categories = await db.StockMaterialCategories
            .Where(c => c.TenantId == request.TenantId && c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new StockMaterialCategoryResponse(c.Id, c.Name, c.IsActive))
            .ToListAsync(cancellationToken);

        return ErrorOrFactory.From(categories);
    }
}
