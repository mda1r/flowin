using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Inventory.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.Commands.ReceiveStock;

internal sealed class ReceiveStockCommandHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext)
    : ICommandHandler<ReceiveStockCommand, StockItemResponse>
{
    public async Task<ErrorOr<StockItemResponse>> Handle(
        ReceiveStockCommand request,
        CancellationToken cancellationToken)
    {
        StockItem? stockItem = await stockItemRepository.FindByIdAsync(
            new StockItemId(request.StockItemId), cancellationToken);

        if (stockItem is null || stockItem.BranchId != request.BranchId)
        {
            return InventoryErrors.StockItemNotFound;
        }

        ErrorOr<Success> result = stockItem.Receive(request.Quantity, request.Reference, request.Notes, request.ExpiryDate);
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
