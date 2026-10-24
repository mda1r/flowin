using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockMaterialMovements;

internal sealed class ListStockMaterialMovementsQueryHandler(InventoryDbContext db)
    : IQueryHandler<ListStockMaterialMovementsQuery, IReadOnlyList<StockMaterialMovementResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<StockMaterialMovementResponse>>> Handle(
        ListStockMaterialMovementsQuery request,
        CancellationToken cancellationToken)
    {
        bool exists = await db.StockMaterials
            .AnyAsync(m => m.Id == request.MaterialId && m.TenantId == request.TenantId, cancellationToken);
        if (!exists)
        {
            return Error.NotFound("Inventory.MaterialNotFound", "Stock material was not found.");
        }

        var rows = await db.StockMaterialMovements
            .Where(m => m.MaterialId == request.MaterialId && m.TenantId == request.TenantId)
            .OrderByDescending(m => m.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken);

        return rows
            .Select(m => new StockMaterialMovementResponse(
                m.Id, m.Type.ToString(), m.QuantityChange, m.UnitCost,
                m.QuantityAfter, m.CostAfter, m.Note, m.UserId, m.CreatedAt))
            .ToList();
    }
}
