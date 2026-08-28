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
            return MapToResponse(existing);
        }

        StockItem stockItem = StockItem.Create(
            request.VariantId,
            request.BranchId,
            request.ReorderPoint,
            request.ReorderQuantity);

        stockItemRepository.Add(stockItem);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(stockItem);
    }

    private static StockItemResponse MapToResponse(StockItem s) => new(
        s.Id.Value, s.VariantId, s.BranchId,
        s.Quantity, s.ReorderPoint, s.ReorderQuantity,
        s.Quantity <= s.ReorderPoint && s.ReorderPoint > 0,
        s.UpdatedAt, s.ExpiryDate, s.NotifyDaysBeforeExpiry);
}
