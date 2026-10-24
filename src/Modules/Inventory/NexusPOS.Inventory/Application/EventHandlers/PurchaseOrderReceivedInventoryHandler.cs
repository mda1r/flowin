using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Inventory.Application.EventHandlers;

// Adds received product quantities to the order's branch stock, at most once per purchase order:
// the receive movements carry the order id as their reference and are saved together.
// Products without a stock record in the branch get one, since buying stock implies tracking it.
internal sealed class PurchaseOrderReceivedInventoryHandler(
    IStockItemRepository stockItemRepository,
    InventoryDbContext db,
    ILogger<PurchaseOrderReceivedInventoryHandler> logger)
    : INotificationHandler<PurchaseOrderReceivedDomainEvent>
{
    public async Task Handle(PurchaseOrderReceivedDomainEvent notification, CancellationToken cancellationToken)
    {
        string reference = notification.PurchaseOrderId.ToString();
        try
        {
            bool alreadyApplied = await db.StockMovements.AnyAsync(
                m => m.Reference == reference && m.Type == MovementType.Receive, cancellationToken);
            if (alreadyApplied)
            {
                return;
            }

            string note = $"أمر شراء #{reference[..8]}";
            foreach (IGrouping<Guid, (Guid VariantId, decimal Quantity)> group in notification.ReceivedItems
                .Where(i => i.VariantId != Guid.Empty && i.Quantity > 0)
                .GroupBy(i => i.VariantId))
            {
                StockItem? stock = await stockItemRepository.FindByVariantAndBranchAsync(
                    group.Key, notification.BranchId, cancellationToken);
                if (stock is null)
                {
                    stock = StockItem.Create(group.Key, notification.BranchId);
                    stockItemRepository.Add(stock);
                }
                else
                {
                    stockItemRepository.Update(stock);
                }

                ErrorOr<Success> result = stock.Receive(group.Sum(i => i.Quantity), reference, note);
                if (result.IsError)
                {
                    logger.LogWarning("Could not receive variant {VariantId} for purchase order {OrderId}: {Error}",
                        group.Key, notification.PurchaseOrderId, result.FirstError.Description);
                }
            }

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            db.ChangeTracker.Clear();
            logger.LogError(ex, "Failed to add product stock for purchase order {OrderId} in tenant {TenantId}",
                notification.PurchaseOrderId, notification.TenantId);
        }
    }
}
