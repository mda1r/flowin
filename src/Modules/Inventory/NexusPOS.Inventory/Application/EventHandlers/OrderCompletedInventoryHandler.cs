using ErrorOr;
using MediatR;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.POS.Domain.Events;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.EventHandlers;

internal sealed class OrderCompletedInventoryHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext dbContext,
    ITenantContext tenantContext,
    ILogger<OrderCompletedInventoryHandler> logger)
    : INotificationHandler<OrderCompletedDomainEvent>
{
    public async Task Handle(OrderCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        // Gaming and restaurant sales are recorded for money and tax only; their stock is handled at the source.
        if (notification.Source != NexusPOS.POS.Domain.Enums.OrderSource.Pos)
        {
            return;
        }

        string note = notification.Number.HasValue
            ? $"فاتورة #{notification.Number.Value}"
            : $"طلب #{notification.OrderId.ToString()[..8]}";

        foreach (OrderCompletedDomainEvent.LineItem line in notification.Lines)
        {
            try
            {
                StockItem? stock = await stockItemRepository.FindByVariantAndBranchAsync(
                    line.VariantId, notification.BranchId, cancellationToken);

                if (stock is null || stock.IsArchived)
                {
                    continue;
                }

                ErrorOr<decimal> result = stock.DeductForSale(
                    line.Quantity,
                    reference: notification.OrderId.ToString(),
                    notes: note,
                    userId: tenantContext.UserId);

                if (result.IsError)
                {
                    logger.LogWarning("Skipped stock deduction for variant {VariantId} in order {OrderId}: {Error}",
                        line.VariantId, notification.OrderId, result.FirstError.Description);
                    continue;
                }

                if (result.Value > 0)
                {
                    logger.LogWarning(
                        "Order {OrderId} sold {Quantity} of variant {VariantId} with only {OnHand} recorded; stock set to zero (shortfall {Shortfall})",
                        notification.OrderId, line.Quantity, line.VariantId, line.Quantity - result.Value, result.Value);
                }

                stockItemRepository.Update(stock);
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
