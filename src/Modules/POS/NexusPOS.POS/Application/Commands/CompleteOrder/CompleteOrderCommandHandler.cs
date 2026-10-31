using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.CompleteOrder;

internal sealed class CompleteOrderCommandHandler(
    IOrderRepository orderRepository,
    PosDbContext dbContext,
    IOrderNumberSequence numbers)
    : ICommandHandler<CompleteOrderCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(
        CompleteOrderCommand request,
        CancellationToken cancellationToken)
    {
        Order? order = await orderRepository.FindByIdAsync(
            new OrderId(request.OrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PosErrors.OrderNotFound;
        }

        ErrorOr<Success> completeResult = order.Complete(request.PaymentMethod, request.AmountTendered, request.CashAmount, request.CardAmount);
        if (completeResult.IsError)
        {
            return completeResult.Errors;
        }

        // Numbered only once the payment is accepted, so a rejected one never burns an invoice number.
        order.AssignNumber(await numbers.NextAsync(order.TenantId, cancellationToken));

        orderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OrderMapper.ToResponse(order);
    }
}
