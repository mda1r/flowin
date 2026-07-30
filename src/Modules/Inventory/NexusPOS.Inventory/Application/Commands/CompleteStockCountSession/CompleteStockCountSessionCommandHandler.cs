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

        if (request.AutoAdjust)
        {
            foreach (StockCountItem item in session.Items.Where(i => i.HasDiscrepancy))
            {
                StockItem? stockItem = await stockItemRepository.FindByIdAsync(
                    new StockItemId(item.StockItemId), cancellationToken);

                if (stockItem is null)
                {
                    continue;
                }

                string reference = $"جرد-{session.Type}-{session.PeriodEnd:yyyyMM}";
                stockItem.Adjust(item.CountedQuantity!.Value, reference, "تعديل تلقائي من الجرد");
                stockItemRepository.Update(stockItem);
            }
        }

        ErrorOr<Success> result = session.Complete();
        if (result.IsError)
        {
            return result.Errors;
        }

        stockCountRepository.Update(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreateStockCountSessionCommandHandler.MapToResponse(session);
    }
}
