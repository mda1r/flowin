using ErrorOr;
using MediatR;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.POS.Domain.Events;

namespace NexusPOS.Inventory.Application.EventHandlers;

internal sealed class OrderCompletedInventoryHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext,
    ILogger<OrderCompletedInventoryHandler> logger)
    : INotificationHandler<OrderCompletedDomainEvent>
{
    public async Task Handle(OrderCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        foreach (OrderCompletedDomainEvent.LineItem line in notification.Lines)
        {
            try
            {
                StockItem? stock = await stockItemRepository.FindByVariantAndBranchAsync(
                    line.VariantId, notification.BranchId, cancellationToken);

                if (stock is null)
                {
                    continue;
                }

                ErrorOr<Success> result = stock.Deduct(
                    line.Quantity,
                    MovementType.Sale,
                    reference: notification.OrderId.ToString(),
                    notes: $"طلب #{notification.OrderId.ToString()[..8]}");

                if (!result.IsError)
                {
                    stockItemRepository.Update(stock);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "فشل خصم المخزون للمتغير {VariantId} في الطلب {OrderId}",
                    line.VariantId, notification.OrderId);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
