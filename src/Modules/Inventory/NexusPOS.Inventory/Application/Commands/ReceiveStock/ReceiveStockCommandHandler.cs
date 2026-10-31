using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.Commands.ReceiveStock;

internal sealed class ReceiveStockCommandHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext,
    ITenantContext tenantContext)
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

        ErrorOr<Success> result = stockItem.Receive(
            request.Quantity, request.Reference, request.Notes, request.ExpiryDate, tenantContext.UserId);
        if (result.IsError)
        {
            return result.Errors;
        }

        stockItemRepository.Update(stockItem);
        await dbContext.SaveChangesAsync(cancellationToken);

        return StockItemResponse.From(stockItem);
    }
}
