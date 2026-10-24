using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Services;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.POS.Domain.Events;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.EventHandlers;

// Deducts raw materials for every recipe in a completed sale. Failures are logged and never block the sale.
internal sealed class OrderCompletedRecipeHandler(
    InventoryDbContext db,
    ITenantContext tenantContext,
    ILogger<OrderCompletedRecipeHandler> logger)
    : INotificationHandler<OrderCompletedDomainEvent>
{
    public async Task Handle(OrderCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            List<Guid> variantIds = notification.Lines.Select(l => l.VariantId).Distinct().ToList();
            List<RecipeLine> recipeLines = await db.RecipeLines
                .Where(r => r.TenantId == notification.TenantId && variantIds.Contains(r.VariantId))
                .ToListAsync(cancellationToken);
            if (recipeLines.Count == 0)
            {
                return;
            }

            Dictionary<Guid, decimal> consumed = RecipeConsumption.ComponentQuantities(
                recipeLines, notification.Lines.Select(l => (l.VariantId, l.Quantity)));

            List<Guid> materialIds = [.. consumed.Keys];
            List<StockMaterial> materials = await db.StockMaterials
                .Where(m => m.TenantId == notification.TenantId && materialIds.Contains(m.Id))
                .ToListAsync(cancellationToken);

            string note = $"بيع طلب #{notification.OrderId.ToString()[..8]}";
            foreach (StockMaterial material in materials)
            {
                decimal before = material.CurrentQuantityInStorageUnits;
                material.Consume(consumed[material.Id]);
                db.StockMaterialMovements.Add(StockMaterialMovement.Record(
                    material, StockMaterialMovementType.Consumption,
                    material.CurrentQuantityInStorageUnits - before, material.CurrentCost, note, tenantContext.UserId));
            }

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to deduct recipe materials for order {OrderId} in tenant {TenantId}",
                notification.OrderId, notification.TenantId);
        }
    }
}
