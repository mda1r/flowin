using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.Application.EventHandlers;

// Puts a paid cafe sale on the kitchen screen, once per POS order. Failures are logged only: the sale is
// already saved, and a store without the kitchen tables (a gaming lounge, say) must still be able to sell.
internal sealed class KitchenTicketRequestedRestaurantHandler(
    RestaurantDbContext db,
    ILogger<KitchenTicketRequestedRestaurantHandler> logger)
    : INotificationHandler<KitchenTicketRequestedDomainEvent>
{
    public async Task Handle(KitchenTicketRequestedDomainEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            bool exists = await db.RestaurantOrders.AnyAsync(
                o => o.KitchenOnly && o.SourceOrderId == notification.OrderId, cancellationToken);
            if (exists)
            {
                return;
            }

            ErrorOr<RestaurantOrder> ticket = RestaurantOrder.CreateKitchenTicket(
                notification.TenantId,
                notification.BranchId,
                notification.OrderId,
                notification.OrderNumber,
                notification.TableNumber,
                notification.Takeaway,
                notification.Lines.Select(l => (
                    l.ItemId,
                    ItemName(l),
                    (int)Math.Ceiling(l.Quantity),
                    l.Notes)));
            if (ticket.IsError)
            {
                logger.LogWarning("Kitchen ticket for order {OrderId} rejected: {Error}",
                    notification.OrderId, ticket.FirstError.Code);
                return;
            }

            db.RestaurantOrders.Add(ticket.Value);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Includes the unique index refusing a ticket another request made at the same moment.
            db.ChangeTracker.Clear();
            logger.LogWarning(ex, "Kitchen ticket for order {OrderId} was not created", notification.OrderId);
        }
    }

    // "Latte - Large" when the size matters; the default variant adds nothing. The plain-variant list
    // (empty, افتراضي, Standard, Default, the product's own name) mirrors isPlainVariant in
    // frontend/src/lib/variantName.ts, so the ticket and the till name a size the same way: change both together.
    internal static string ItemName(KitchenTicketRequestedDomainEvent.Line line)
    {
        string variant = line.VariantName.Trim();
        bool plain = variant.Length == 0 || variant is "افتراضي" or "Standard" or "Default" || variant == line.Name.Trim();
        string name = plain ? line.Name.Trim() : $"{line.Name.Trim()} - {variant}";
        return name.Length > 128 ? name[..128] : name;
    }
}
