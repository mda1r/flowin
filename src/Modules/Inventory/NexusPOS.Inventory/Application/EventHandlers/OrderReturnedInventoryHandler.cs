using ErrorOr;
using MediatR;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.POS.Domain.Events;

namespace NexusPOS.Inventory.Application.EventHandlers;

internal sealed class OrderReturnedInventoryHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext,
    ILogger<OrderReturnedInventoryHandler> logger)
    : INotificationHandler<ReturnOrderCompletedDomainEvent>
{
    public async Task Handle(ReturnOrderCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        foreach (ReturnOrderCompletedDomainEvent.LineItem line in notification.Lines)
        {
            try
            {
                StockItem? stock = await stockItemRepository.FindByVariantAndBranchAsync(
                    line.VariantId, notification.BranchId, cancellationToken);

                if (stock is null)
                {
                    continue;
                }

                ErrorOr<Success> result = stock.Receive(
                    line.Quantity,
                    reference: notification.ReturnOrderId.ToString(),
                    notes: $"إرجاع طلب #{notification.OriginalOrderId.ToString()[..8]}");

                if (!result.IsError)
                {
                    stockItemRepository.Update(stock);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "فشل استعادة المخزون للمتغير {VariantId} في الإرجاع {ReturnOrderId}",
                    line.VariantId, notification.ReturnOrderId);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
