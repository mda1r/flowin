using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.POS.Application.Commands.Checkout;

internal sealed class CheckoutOrderCommandHandler(PosDbContext db, ICustomerLoyaltyDirectory loyalty)
    : ICommandHandler<CheckoutOrderCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(CheckoutOrderCommand request, CancellationToken cancellationToken)
    {
        Order? existing = await FindByReference(request, cancellationToken);
        if (existing is not null)
        {
            return OrderMapper.ToResponse(existing);
        }

        if (request.LoyaltyPoints > 0 && request.CustomerId is Guid customerId)
        {
            int? available = await loyalty.GetPointsAsync(request.TenantId, customerId, cancellationToken);
            if (available is null || available < request.LoyaltyPoints)
            {
                return PosErrors.InsufficientLoyaltyPoints;
            }
        }

        ErrorOr<Order> built = CheckoutBuilder.Build(request);
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

            return OrderMapper.ToResponse(existing);
        }

        return OrderMapper.ToResponse(built.Value);
    }

    private Task<Order?> FindByReference(CheckoutOrderCommand request, CancellationToken ct) =>
        db.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.ClientReference == request.ClientReference && o.BranchId == request.BranchId, ct);
}
