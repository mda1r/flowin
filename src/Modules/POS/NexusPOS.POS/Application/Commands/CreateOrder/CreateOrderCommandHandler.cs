using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.CreateOrder;

internal sealed class CreateOrderCommandHandler(
    IOrderRepository orderRepository,
    PosDbContext dbContext)
    : ICommandHandler<CreateOrderCommand, OrderResponse>
{
    public async Task<ErrorOr<OrderResponse>> Handle(
        CreateOrderCommand request,
        CancellationToken cancellationToken)
    {
        Order order = Order.Create(
            request.TenantId,
            request.BranchId,
            request.Currency,
            request.CustomerId,
            request.TaxRate);

        orderRepository.Add(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OrderMapper.ToResponse(order);
    }
}
