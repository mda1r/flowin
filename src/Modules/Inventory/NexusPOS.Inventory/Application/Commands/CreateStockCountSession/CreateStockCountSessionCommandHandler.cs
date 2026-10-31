using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Application.Services;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CreateStockCountSession;

internal sealed class CreateStockCountSessionCommandHandler(
    IStockCountRepository stockCountRepository,
    IStockItemRepository stockItemRepository,
    IVariantCostLookup variantCostLookup,
    InventoryDbContext dbContext)
    : ICommandHandler<CreateStockCountSessionCommand, StockCountSessionResponse>
{
    public async Task<ErrorOr<StockCountSessionResponse>> Handle(
        CreateStockCountSessionCommand request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse(request.Type, ignoreCase: true, out StockCountType type) || !Enum.IsDefined(type))
        {
            return InventoryErrors.InvalidStockCountType;
        }

        // Two open counts on one branch would each adjust the same stock when completed.
        if (await stockCountRepository.HasOpenSessionAsync(request.BranchId, cancellationToken))
        {
            return InventoryErrors.StockCountOpenExists;
        }

        IReadOnlyList<StockItem> stockItems = await stockItemRepository.FindByBranchAsync(request.BranchId, cancellationToken: cancellationToken);
        if (stockItems.Count == 0)
        {
            return InventoryErrors.StockCountNoItems;
        }

        // Snapshot quantities and costs on the server; the browser's copy may be stale or incomplete.
        IReadOnlyDictionary<Guid, decimal> costs = await variantCostLookup.GetCostsAsync(
            stockItems.Select(s => s.VariantId).Distinct().ToList(), cancellationToken);

        StockCountSession session = StockCountSession.Create(
            request.BranchId,
            type,
            request.PeriodStart,
            request.PeriodEnd,
            request.Notes);

        foreach (StockItem stockItem in stockItems)
        {
            session.AddItem(StockCountItem.Create(
                session.Id,
                stockItem.Id.Value,
                stockItem.VariantId,
                stockItem.Quantity,
                costs.GetValueOrDefault(stockItem.VariantId)));
        }

        stockCountRepository.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(session);
    }

    internal static StockCountSessionResponse MapToResponse(StockCountSession session) =>
        new(session.Id.Value,
            session.BranchId,
            session.Type.ToString(),
            session.Status.ToString(),
            session.PeriodStart,
            session.PeriodEnd,
            session.Notes,
            session.CreatedAt,
            session.CompletedAt,
            session.TotalItems,
            session.CountedItems,
            session.DiscrepancyCount,
            session.TotalSystemValue,
            session.TotalCountedValue,
            session.TotalTaxAmount,
            session.Items.Select(i => new StockCountItemResponse(
                i.Id.Value,
                i.StockItemId,
                i.VariantId,
                i.SystemQuantity,
                i.CountedQuantity,
                i.Difference,
                i.UnitCost,
                i.SystemValue,
                i.CountedValue,
                i.TaxAmount,
                i.HasDiscrepancy)).ToList());
}
