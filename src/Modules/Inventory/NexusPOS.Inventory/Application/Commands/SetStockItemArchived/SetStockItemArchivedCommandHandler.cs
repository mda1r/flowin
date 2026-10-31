using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.SetStockItemArchived;

internal sealed class SetStockItemArchivedCommandHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext)
    : ICommandHandler<SetStockItemArchivedCommand, StockItemResponse>
{
    public async Task<ErrorOr<StockItemResponse>> Handle(
        SetStockItemArchivedCommand request,
        CancellationToken cancellationToken)
    {
        StockItem? stockItem = await stockItemRepository.FindByIdAsync(
            new StockItemId(request.StockItemId), cancellationToken);

        if (stockItem is null || stockItem.BranchId != request.BranchId)
        {
            return InventoryErrors.StockItemNotFound;
        }

        if (request.Archived)
        {
            stockItem.Archive();
        }
        else
        {
            stockItem.Restore();
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return StockItemResponse.From(stockItem);
    }
}
