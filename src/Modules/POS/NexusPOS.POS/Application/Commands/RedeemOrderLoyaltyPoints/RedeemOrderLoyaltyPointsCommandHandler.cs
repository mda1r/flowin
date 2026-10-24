using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.POS.Application.Commands.RedeemOrderLoyaltyPoints;

internal sealed class RedeemOrderLoyaltyPointsCommandHandler(
    IOrderRepository orderRepository,
    PosDbContext dbContext,
    ICustomerLoyaltyDirectory loyalty)
    : ICommandHandler<RedeemOrderLoyaltyPointsCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(
        RedeemOrderLoyaltyPointsCommand request,
        CancellationToken cancellationToken)
    {
        Order? order = await orderRepository.FindByIdAsync(new OrderId(request.OrderId), cancellationToken);
        if (order is null || order.BranchId != request.BranchId)
        {
            return PosErrors.OrderNotFound;
        }

        if (request.Points > 0 && order.CustomerId is Guid customerId)
        {
            int? available = await loyalty.GetPointsAsync(order.TenantId, customerId, cancellationToken);
            if (available is null || available < request.Points)
            {
                return PosErrors.InsufficientLoyaltyPoints;
            }
        }

        ErrorOr<Success> result = order.RedeemLoyaltyPoints(request.Points);
        if (result.IsError)
        {
            return result.Errors;
        }

        orderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OrderMapper.ToResponse(order);
    }
}
