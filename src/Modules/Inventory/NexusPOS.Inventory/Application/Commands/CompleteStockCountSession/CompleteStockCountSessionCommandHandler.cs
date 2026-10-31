using ErrorOr;
using NexusPOS.Inventory.Application.Commands.CreateStockCountSession;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CompleteStockCountSession;

internal sealed class CompleteStockCountSessionCommandHandler(
    IStockCountRepository stockCountRepository,
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext)
    : ICommandHandler<CompleteStockCountSessionCommand, StockCountSessionResponse>
{
    public async Task<ErrorOr<StockCountSessionResponse>> Handle(
        CompleteStockCountSessionCommand request,
        CancellationToken cancellationToken)
    {
        StockCountSession? session = await stockCountRepository.FindByIdAsync(
            new StockCountSessionId(request.SessionId), cancellationToken);

        if (session is null || session.BranchId != request.BranchId)
        {
            return InventoryErrors.StockCountNotFound;
        }

        // Nothing is saved unless every step succeeds, so a failed adjustment leaves the session open.
        ErrorOr<Success> result = session.Complete();
        if (result.IsError)
        {
            return result.Errors;
        }

        List<StockCountItem> discrepancies = session.Items.Where(i => i.HasDiscrepancy).ToList();
        if (request.AutoAdjust && discrepancies.Count > 0)
        {
            Dictionary<Guid, StockItem> stockById =
                (await stockItemRepository.FindByBranchAsync(session.BranchId, cancellationToken))
                .ToDictionary(s => s.Id.Value);
            string reference = $"جرد-{session.Id.Value}";

            foreach (StockCountItem item in discrepancies)
            {
                if (!stockById.TryGetValue(item.StockItemId, out StockItem? stockItem))
                {
                    continue;
                }

                // Apply only the counted difference, so sales and receipts made during the count are kept.
                ErrorOr<Success> adjusted = stockItem.ApplyCountDifference(
                    item.Difference, reference, "تعديل تلقائي من الجرد");
                if (adjusted.IsError)
                {
                    return adjusted.Errors;
                }

                stockItemRepository.Update(stockItem);
            }
        }

        stockCountRepository.Update(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreateStockCountSessionCommandHandler.MapToResponse(session);
    }
}
