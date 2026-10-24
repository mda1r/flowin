using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Commands.CreateStockMaterial;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockMaterials;

internal sealed class ListStockMaterialsQueryHandler(InventoryDbContext db)
    : IQueryHandler<ListStockMaterialsQuery, IReadOnlyList<StockMaterialResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<StockMaterialResponse>>> Handle(
        ListStockMaterialsQuery request,
        CancellationToken cancellationToken)
    {
        IQueryable<StockMaterial> query = db.StockMaterials
            .Where(m => m.TenantId == request.TenantId && m.IsActive);

        if (request.CategoryId.HasValue)
        {
            query = query.Where(m => m.CategoryId == request.CategoryId);
        }

        if (request.LowStockOnly)
        {
            query = query.Where(m => m.ReorderLevel.HasValue && m.CurrentQuantityInStorageUnits <= m.ReorderLevel);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            string pattern = $"%{request.Search}%";
            query = query.Where(m =>
                EF.Functions.ILike(m.NameAr, pattern) ||
                (m.NameEn != null && EF.Functions.ILike(m.NameEn, pattern)) ||
                EF.Functions.ILike(m.Code, pattern));
        }

        var rows = await (
            from m in query.OrderBy(m => m.NameAr)
            join c in db.StockMaterialCategories on m.CategoryId equals (Guid?)c.Id into cj
            from c in cj.DefaultIfEmpty()
            select new { m, CategoryName = c!.Name }
        ).ToListAsync(cancellationToken);

        IReadOnlyList<StockMaterialResponse> responses = rows
            .Select(x => CreateStockMaterialCommandHandler.ToResponse(x.m, x.CategoryName))
            .ToList();

        return ErrorOrFactory.From(responses);
    }
}
