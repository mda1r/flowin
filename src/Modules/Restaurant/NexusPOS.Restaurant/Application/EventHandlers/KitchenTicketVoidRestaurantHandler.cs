using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.Application.EventHandlers;

// Takes a cancelled or refunded cafe sale off the kitchen screen, so nobody makes drinks that were given back.
// A ticket already handed over (Served) stays as it is. Failures are logged only: the refund is already saved,
// and a store without the kitchen tables must still be able to give one.
internal sealed class KitchenTicketVoidRestaurantHandler(
    RestaurantDbContext db,
    ILogger<KitchenTicketVoidRestaurantHandler> logger)
    : INotificationHandler<KitchenTicketVoidRequestedDomainEvent>
{
    public async Task Handle(KitchenTicketVoidRequestedDomainEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            RestaurantOrder? ticket = await db.RestaurantOrders.FirstOrDefaultAsync(
                o => o.KitchenOnly
                    && o.TenantId == notification.TenantId
                    && o.SourceOrderId == notification.SourceOrderId,
                cancellationToken);
            if (ticket is null || !Void(ticket, notification.Reason))
            {
                return;
            }

            // A barista moving the ticket at the same moment wins; the next poll shows whichever state was saved.
            ErrorOr<Success> saved = await RestaurantSave.SaveAsync(db, RestaurantErrors.OrderChanged, cancellationToken);
            if (saved.IsError)
            {
                db.ChangeTracker.Clear();
                logger.LogWarning("Kitchen ticket for order {OrderId} was not voided: {Error}",
                    notification.SourceOrderId, saved.FirstError.Code);
            }
        }
        catch (Exception ex)
        {
            db.ChangeTracker.Clear();
            logger.LogWarning(ex, "Kitchen ticket for order {OrderId} was not voided", notification.SourceOrderId);
        }
    }

    // Cancels a ticket still waiting, being made or ready on the counter; true when it changed.
    internal static bool Void(RestaurantOrder ticket, string? reason)
    {
        if (!ticket.KitchenOnly || ticket.Status is RestaurantOrderStatus.Served or RestaurantOrderStatus.Cancelled)
        {
            return false;
        }

        string text = string.IsNullOrWhiteSpace(reason) ? KitchenTicketVoidRequestedDomainEvent.CancelledReason : reason;
        return !ticket.Cancel(text, null).IsError;
    }
}
