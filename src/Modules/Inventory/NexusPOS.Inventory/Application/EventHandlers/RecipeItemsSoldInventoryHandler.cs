using MediatR;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Application.Services;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Inventory.Application.EventHandlers;

// Deducts raw materials for restaurant (and other non-POS) sales. Failures are logged and never block payment.
internal sealed class RecipeItemsSoldInventoryHandler(
    InventoryDbContext db,
    ITenantContext tenantContext,
    ILogger<RecipeItemsSoldInventoryHandler> logger)
    : INotificationHandler<RecipeItemsSoldDomainEvent>
{
    public async Task Handle(RecipeItemsSoldDomainEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            await RecipeStockDeduction.DeductAsync(
                db, notification.TenantId, notification.SaleId,
                [.. notification.Lines.Select(l => (l.ItemId, l.Quantity))],
                tenantContext.UserId, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to deduct recipe materials for sale {SaleId} in tenant {TenantId}",
                notification.SaleId, notification.TenantId);
        }
    }
}
