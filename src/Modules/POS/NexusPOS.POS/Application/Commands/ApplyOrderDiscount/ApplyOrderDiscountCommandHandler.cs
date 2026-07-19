using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.ApplyOrderDiscount;

internal sealed class ApplyOrderDiscountCommandHandler(
    IOrderRepository orderRepository,
    PosDbContext dbContext)
    : ICommandHandler<ApplyOrderDiscountCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(
        ApplyOrderDiscountCommand request,
        CancellationToken cancellationToken)
    {
        Order? order = await orderRepository.FindByIdAsync(
            new OrderId(request.OrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PosErrors.OrderNotFound;
        }

        ErrorOr<Success> applyResult = order.ApplyDiscount(request.DiscountType, request.DiscountValue);
        if (applyResult.IsError)
        {
            return applyResult.Errors;
        }

        orderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OrderMapper.ToResponse(order);
    }
}
