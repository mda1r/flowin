using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.EventHandlers;

// Applies a received purchase order's raw-material lines exactly once. The receipt marker is saved in the
// same SaveChanges as the material updates, so a retry after a failure re-applies, and a retry after
// success is a no-op. Failures are logged; the order page shows the status and offers a retry.
internal sealed class StockMaterialsPurchasedInventoryHandler(
    InventoryDbContext db,
    ITenantContext tenantContext,
    ILogger<StockMaterialsPurchasedInventoryHandler> logger)
    : INotificationHandler<StockMaterialsPurchasedDomainEvent>
{
    public async Task Handle(StockMaterialsPurchasedDomainEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            bool alreadyApplied = await db.StockMaterialReceipts.AnyAsync(
                r => r.PurchaseOrderId == notification.PurchaseOrderId && r.TenantId == notification.TenantId,
                cancellationToken);
            if (alreadyApplied)
            {
                return;
            }

            List<Guid> ids = [.. notification.Lines.Select(l => l.MaterialId).Distinct()];
            Dictionary<Guid, StockMaterial> materials = await db.StockMaterials
                .Where(m => ids.Contains(m.Id) && m.TenantId == notification.TenantId)
                .ToDictionaryAsync(m => m.Id, cancellationToken);

            string note = $"أمر شراء #{notification.PurchaseOrderId.ToString()[..8]}";
            int applied = 0;

            foreach (StockMaterialsPurchasedDomainEvent.Line line in notification.Lines)
            {
                if (!materials.TryGetValue(line.MaterialId, out StockMaterial? material))
                {
                    logger.LogWarning(
                        "Purchase order {OrderId} references stock material {MaterialId} not found in tenant {TenantId}",
                        notification.PurchaseOrderId, line.MaterialId, notification.TenantId);
                    continue;
                }

                if (line.Quantity <= 0 || line.UnitCost < 0)
                {
                    continue;
                }

                material.Receive(line.Quantity, line.UnitCost);
                db.StockMaterialMovements.Add(StockMaterialMovement.Record(
                    material, StockMaterialMovementType.Receive, line.Quantity, line.UnitCost, note, tenantContext.UserId));
                applied++;
            }

            db.StockMaterialReceipts.Add(StockMaterialReceipt.Create(notification.TenantId, notification.PurchaseOrderId, applied));
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            db.ChangeTracker.Clear();
            logger.LogError(ex, "Failed to apply raw materials for purchase order {OrderId} in tenant {TenantId}",
                notification.PurchaseOrderId, notification.TenantId);
        }
    }
}
