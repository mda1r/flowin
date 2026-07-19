using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetStockItem;

internal sealed class GetStockItemQueryHandler(IStockItemRepository stockItemRepository)
    : IQueryHandler<GetStockItemQuery, StockItemResponse>
{
    public async Task<ErrorOr<StockItemResponse>> Handle(
        GetStockItemQuery request,
        CancellationToken cancellationToken)
    {
        StockItem? stockItem = await stockItemRepository.FindByIdAsync(
            new StockItemId(request.StockItemId), cancellationToken);

        if (stockItem is null || stockItem.BranchId != request.BranchId)
        {
            return InventoryErrors.StockItemNotFound;
        }

        return new StockItemResponse(
            stockItem.Id.Value, stockItem.VariantId, stockItem.BranchId,
            stockItem.Quantity, stockItem.ReorderPoint, stockItem.ReorderQuantity,
            stockItem.Quantity <= stockItem.ReorderPoint && stockItem.ReorderPoint > 0,
            stockItem.UpdatedAt, stockItem.ExpiryDate);
    }
}
