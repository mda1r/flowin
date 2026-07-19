using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Inventory.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.Commands.AdjustStock;

internal sealed class AdjustStockCommandHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext)
    : ICommandHandler<AdjustStockCommand, StockItemResponse>
{
    public async Task<ErrorOr<StockItemResponse>> Handle(
        AdjustStockCommand request,
        CancellationToken cancellationToken)
    {
        StockItem? stockItem = await stockItemRepository.FindByIdAsync(
            new StockItemId(request.StockItemId), cancellationToken);

        if (stockItem is null || stockItem.BranchId != request.BranchId)
        {
            return InventoryErrors.StockItemNotFound;
        }

        ErrorOr<Success> result = stockItem.Adjust(request.NewQuantity, request.Reference, request.Notes);
        if (result.IsError)
        {
            return result.Errors;
        }

        stockItemRepository.Update(stockItem);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new StockItemResponse(
            stockItem.Id.Value, stockItem.VariantId, stockItem.BranchId,
            stockItem.Quantity, stockItem.ReorderPoint, stockItem.ReorderQuantity,
            stockItem.Quantity <= stockItem.ReorderPoint && stockItem.ReorderPoint > 0,
            stockItem.UpdatedAt, stockItem.ExpiryDate);
    }
}
