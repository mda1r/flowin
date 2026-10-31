using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Application.Commands.Checkout;

internal sealed class CheckoutOrderCommandHandler(
    PosDbContext db, ICustomerLoyaltyDirectory loyalty, IOrderNumberSequence numbers, IPublisher publisher)
    : ICommandHandler<CheckoutOrderCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(CheckoutOrderCommand request, CancellationToken cancellationToken)
    {
        Order? existing = await FindByReference(request.ClientReference, cancellationToken);
        if (existing is not null)
        {
            return Replay(existing, request);
        }

        ErrorOr<LoyaltyRules> rules = await LoyaltyRedemption.CheckAsync(
            loyalty, request.TenantId, request.CustomerId, request.LoyaltyPoints, cancellationToken);
        if (rules.IsError)
        {
            return rules.Errors;
        }

        // Every check runs before the sale takes an invoice number, so a rejected sale leaves no gap in the sequence.
        ErrorOr<Order> built = CheckoutBuilder.Build(request, rules.Value);
        if (built.IsError)
        {
            return built.Errors;
        }

        Order order = built.Value;

        // The number and the sale commit together: if the save fails, the counter rolls back with it.
        await using IDbContextTransaction transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        order.AssignNumber(await numbers.NextAsync(request.TenantId, cancellationToken));
        List<IDomainEvent> events = [.. order.DomainEvents];
        order.ClearDomainEvents();
        db.Orders.Add(order);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // The same sale arrived twice at once and the other request saved it first.
            await transaction.RollbackAsync(cancellationToken);
            db.ChangeTracker.Clear();
            existing = await FindByReference(request.ClientReference, cancellationToken);
            if (existing is null)
            {
                throw;
            }

            return Replay(existing, request);
        }

        // Published once committed, as SaveChanges does, so other modules never act on a sale that rolled back.
        foreach (IDomainEvent domainEvent in events)
        {
            await publisher.Publish(domainEvent, cancellationToken);
        }

        return OrderMapper.ToResponse(order);
    }

    // The reference is unique across the store, so one already used by another branch is a clean conflict, not a crash.
    private static ErrorOr<OrderResponse> Replay(Order existing, CheckoutOrderCommand request) =>
        existing.BranchId == request.BranchId ? OrderMapper.ToResponse(existing) : PosErrors.ClientReferenceInUse;

    private Task<Order?> FindByReference(Guid clientReference, CancellationToken ct) =>
        db.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.ClientReference == clientReference, ct);
}
