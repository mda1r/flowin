using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListRecipeSummaries;

internal sealed class ListRecipeSummariesQueryHandler(InventoryDbContext db)
    : IQueryHandler<ListRecipeSummariesQuery, IReadOnlyList<RecipeSummaryResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<RecipeSummaryResponse>>> Handle(
        ListRecipeSummariesQuery request, CancellationToken cancellationToken)
    {
        var rows = await db.RecipeLines
            .Where(r => r.TenantId == request.TenantId)
            .Join(db.StockMaterials, r => r.MaterialId, m => m.Id,
                (r, m) => new { r.VariantId, r.Quantity, m.CurrentCost, m.ConversionFactor })
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(x => x.VariantId)
            .Select(g => new RecipeSummaryResponse(
                g.Key,
                g.Count(),
                Math.Round(g.Sum(x => x.ConversionFactor > 0 ? x.Quantity * x.CurrentCost / x.ConversionFactor : 0m), 4)))
            .ToList();
    }
}
