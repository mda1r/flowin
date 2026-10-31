using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Application.Commands.Checkout;

internal sealed class CheckoutOrderCommandHandler(
    PosDbContext db,
    ICustomerLoyaltyDirectory loyalty,
    IOrderNumberSequence numbers,
    IVariantPriceDirectory prices,
    IPublisher publisher)
    : ICommandHandler<CheckoutOrderCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(CheckoutOrderCommand request, CancellationToken cancellationToken)
    {
        Order? existing = await FindByReference(request, cancellationToken);
        if (existing is not null)
        {
            return await Done(request, existing, cancellationToken);
        }

        ErrorOr<LoyaltyRules> rules = await LoyaltyRedemption.CheckAsync(
            loyalty, request.TenantId, request.CustomerId, request.LoyaltyPoints, cancellationToken);
        if (rules.IsError)
        {
            return rules.Errors;
        }

        IReadOnlyDictionary<Guid, decimal>? catalogPrices = request.IsManager
            ? null
            : await prices.GetSalePricesAsync([.. request.Lines.Select(l => l.VariantId)], cancellationToken);

        // Check the sale before taking an invoice number, so a refused sale never leaves a gap in the sequence.
        ErrorOr<Order> dryRun = CheckoutBuilder.Build(request, rules.Value, null, catalogPrices);
        if (dryRun.IsError)
        {
            return dryRun.Errors;
        }

        long number = await numbers.NextAsync(request.TenantId, cancellationToken);
        ErrorOr<Order> built = CheckoutBuilder.Build(request, rules.Value, number, catalogPrices);
        if (built.IsError)
        {
            return built.Errors;
        }

        db.Orders.Add(built.Value);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // The same sale arrived twice at once and the other request saved it first.
            db.ChangeTracker.Clear();
            existing = await FindByReference(request, cancellationToken);
            if (existing is null)
            {
                throw;
            }

            return await Done(request, existing, cancellationToken);
        }

        return await Done(request, built.Value, cancellationToken);
    }

    // A resent sale asks for its kitchen ticket again; the kitchen keeps one ticket per order, so a ticket that
    // failed the first time is made now and one that already exists is left alone.
    private async Task<ErrorOr<OrderResponse>> Done(CheckoutOrderCommand request, Order order, CancellationToken ct)
    {
        if (request.Kitchen is { } kitchen)
        {
            await publisher.Publish(new KitchenTicketRequestedDomainEvent(
                order.TenantId,
                order.BranchId,
                order.Id.Value,
                order.Number,
                kitchen.Takeaway ? null : kitchen.TableNumber,
                kitchen.Takeaway,
                [.. order.Lines.Select(l => new KitchenTicketRequestedDomainEvent.Line(
                    l.VariantId, l.ProductName, l.VariantName, l.Quantity, l.Notes))]), ct);
        }

        return OrderMapper.ToResponse(order);
    }

    private Task<Order?> FindByReference(CheckoutOrderCommand request, CancellationToken ct) =>
        db.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.ClientReference == request.ClientReference && o.BranchId == request.BranchId, ct);
}
