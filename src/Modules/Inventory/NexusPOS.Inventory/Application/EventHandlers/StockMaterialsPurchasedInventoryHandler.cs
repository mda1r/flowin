using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.EventHandlers;

internal sealed class StockMaterialsPurchasedInventoryHandler(
    InventoryDbContext db,
    ITenantContext tenantContext,
    ILogger<StockMaterialsPurchasedInventoryHandler> logger)
    : INotificationHandler<StockMaterialsPurchasedDomainEvent>
{
    public async Task Handle(StockMaterialsPurchasedDomainEvent notification, CancellationToken cancellationToken)
    {
        List<Guid> ids = notification.Lines.Select(l => l.MaterialId).Distinct().ToList();
        Dictionary<Guid, StockMaterial> materials = await db.StockMaterials
            .Where(m => ids.Contains(m.Id) && m.TenantId == notification.TenantId)
            .ToDictionaryAsync(m => m.Id, cancellationToken);

        string note = $"أمر شراء #{notification.PurchaseOrderId.ToString()[..8]}";

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
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
