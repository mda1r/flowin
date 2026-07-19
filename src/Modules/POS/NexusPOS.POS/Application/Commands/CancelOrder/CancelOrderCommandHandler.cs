using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.CancelOrder;

internal sealed class CancelOrderCommandHandler(
    IOrderRepository orderRepository,
    PosDbContext dbContext)
    : ICommandHandler<CancelOrderCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(
        CancelOrderCommand request,
        CancellationToken cancellationToken)
    {
        Order? order = await orderRepository.FindByIdAsync(
            new OrderId(request.OrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PosErrors.OrderNotFound;
        }

        ErrorOr<Success> cancelResult = order.Cancel(request.Reason);
        if (cancelResult.IsError)
        {
            return cancelResult.Errors;
        }

        orderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OrderMapper.ToResponse(order);
    }
}
