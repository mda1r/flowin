using ErrorOr;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.DeleteStockItem;

internal sealed class DeleteStockItemCommandHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext)
    : ICommandHandler<DeleteStockItemCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        DeleteStockItemCommand request,
        CancellationToken cancellationToken)
    {
        StockItem? stockItem = await stockItemRepository.FindByIdAsync(
            new StockItemId(request.StockItemId), cancellationToken);

        if (stockItem is null || stockItem.BranchId != request.BranchId)
        {
            return InventoryErrors.StockItemNotFound;
        }

        stockItemRepository.Remove(stockItem);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success;
    }
}
