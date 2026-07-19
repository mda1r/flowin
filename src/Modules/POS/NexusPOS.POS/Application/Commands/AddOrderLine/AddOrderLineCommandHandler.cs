using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.AddOrderLine;

internal sealed class AddOrderLineCommandHandler(
    IOrderRepository orderRepository,
    PosDbContext dbContext)
    : ICommandHandler<AddOrderLineCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(
        AddOrderLineCommand request,
        CancellationToken cancellationToken)
    {
        Order? order = await orderRepository.FindByIdAsync(
            new OrderId(request.OrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PosErrors.OrderNotFound;
        }

        ErrorOr<OrderLine> lineResult = order.AddLine(
            request.VariantId,
            request.ProductName,
            request.VariantName,
            request.UnitPrice,
            request.Quantity);

        if (lineResult.IsError)
        {
            return lineResult.Errors;
        }

        orderRepository.Update(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OrderMapper.ToResponse(order);
    }
}
