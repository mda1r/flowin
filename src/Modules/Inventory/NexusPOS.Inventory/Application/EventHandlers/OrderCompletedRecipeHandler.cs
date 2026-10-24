using MediatR;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Application.Services;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.POS.Domain.Events;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.EventHandlers;

// Deducts raw materials for every recipe in a completed POS sale. Failures are logged and never block the sale.
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
            await RecipeStockDeduction.DeductAsync(
                db, notification.TenantId, notification.OrderId,
                [.. notification.Lines.Select(l => (l.VariantId, l.Quantity))],
                tenantContext.UserId, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to deduct recipe materials for order {OrderId} in tenant {TenantId}",
                notification.OrderId, notification.TenantId);
        }
    }
}
