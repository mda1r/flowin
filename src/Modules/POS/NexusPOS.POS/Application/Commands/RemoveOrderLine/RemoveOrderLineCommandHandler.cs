using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.RemoveOrderLine;

internal sealed class RemoveOrderLineCommandHandler(
    IOrderRepository orderRepository,
    PosDbContext dbContext)
    : ICommandHandler<RemoveOrderLineCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(
        RemoveOrderLineCommand request,
        CancellationToken cancellationToken)
    {
        Order? order = await orderRepository.FindByIdAsync(
            new OrderId(request.OrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PosErrors.OrderNotFound;
        }

        ErrorOr<Success> removeResult = order.RemoveLine(new OrderLineId(request.OrderLineId));
        if (removeResult.IsError)
        {
            return removeResult.Errors;
        }

        orderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OrderMapper.ToResponse(order);
    }
}
