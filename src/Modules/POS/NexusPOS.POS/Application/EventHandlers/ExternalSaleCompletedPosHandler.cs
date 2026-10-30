using MediatR;
using NexusPOS.POS.Application.Common;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Application.EventHandlers;

// Records a gaming or restaurant payment as a completed POS order, once per source reference.
// Exceptions propagate on purpose: the paying module saves its "paid" state only after this succeeds,
// so a failure leaves the payment retryable instead of recorded with no sale.
internal sealed class ExternalSaleCompletedPosHandler(PosDbContext db,
    IOrderNumberSequence numbers)
    : INotificationHandler<ExternalSaleCompletedDomainEvent>
{
    public async Task Handle(ExternalSaleCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        OrderSource source = notification.Source switch
        {
            ExternalSaleCompletedDomainEvent.Gaming => OrderSource.Gaming,
            ExternalSaleCompletedDomainEvent.Restaurant => OrderSource.Restaurant,
            _ => throw new ArgumentOutOfRangeException(nameof(notification), notification.Source, "Unknown external sale source."),
        };

        bool recorded = await db.Orders.AnyAsync(
            o => o.Source == source && o.SourceReferenceId == notification.SourceReferenceId, cancellationToken);
        if (recorded)
        {
            return;
        }

        Order order = Order.CreateExternal(
            notification.TenantId, notification.BranchId, "SAR", notification.TaxRate, source, notification.SourceReferenceId);

        foreach (ExternalSaleCompletedDomainEvent.Line line in notification.Lines)
        {
            Throw(order.AddLine(line.ItemId, line.Name, string.Empty, line.UnitPrice, 0m, line.Quantity));
        }

        if (notification.Discount > 0)
        {
            Throw(order.ApplyDiscount(DiscountType.Fixed, notification.Discount));
        }

        PaymentMethod method = notification.PaymentMethod == "Card" ? PaymentMethod.Card : PaymentMethod.Cash;
        order.AssignNumber(await numbers.NextAsync(notification.TenantId, cancellationToken));
        Throw(order.Complete(method, Math.Max(notification.AmountTendered, Math.Ceiling(order.TotalAmount * 100) / 100)));

        db.Orders.Add(order);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static void Throw<T>(ErrorOr.ErrorOr<T> result)
    {
        if (result.IsError)
        {
            throw new InvalidOperationException($"External sale rejected: {result.FirstError.Code} {result.FirstError.Description}");
        }
    }
}
