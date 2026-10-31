using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Inventory.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.Commands.InitializeStock;

internal sealed class InitializeStockCommandHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext)
    : ICommandHandler<InitializeStockCommand, StockItemResponse>
{
    public async Task<ErrorOr<StockItemResponse>> Handle(
        InitializeStockCommand request,
        CancellationToken cancellationToken)
    {
        StockItem? existing = await stockItemRepository.FindByVariantAndBranchAsync(
            request.VariantId, request.BranchId, cancellationToken);

        if (existing is not null)
        {
            // Turning tracking back on for an archived item brings it back with its history.
            if (existing.IsArchived)
            {
                existing.Restore();
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return StockItemResponse.From(existing);
        }

        StockItem stockItem = StockItem.Create(
            request.VariantId,
            request.BranchId,
            request.ReorderPoint,
            request.ReorderQuantity);

        stockItemRepository.Add(stockItem);
        await dbContext.SaveChangesAsync(cancellationToken);

        return StockItemResponse.From(stockItem);
    }
}
