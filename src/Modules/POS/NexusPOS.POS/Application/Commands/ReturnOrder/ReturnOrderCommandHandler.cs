using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using OrderEntity = NexusPOS.POS.Domain.Entities.Order;
using OrderLineEntity = NexusPOS.POS.Domain.Entities.OrderLine;
using ReturnOrderEntity = NexusPOS.POS.Domain.Entities.ReturnOrder;

namespace NexusPOS.POS.Application.Commands.ReturnOrder;

internal sealed class ReturnOrderCommandHandler(
    IOrderRepository orderRepository,
    IReturnOrderRepository returnOrderRepository,
    PosDbContext dbContext)
    : ICommandHandler<ReturnOrderCommand, ReturnOrderResponse>
{
    public async Task<ErrorOr<ReturnOrderResponse>> Handle(
        ReturnOrderCommand request,
        CancellationToken cancellationToken)
    {
        OrderEntity? order = await orderRepository.FindByIdAsync(
            new OrderId(request.OriginalOrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PosErrors.OrderNotFound;
        }

        if (order.Status != OrderStatus.Completed)
        {
            return Error.Validation("ReturnOrder.OrderNotCompleted", "Only completed orders can be returned.");
        }

        // Build return line tuples by matching requested lineIds to the order lines
        List<(Guid lineId, Guid variantId, string productName, string variantName, decimal quantity, decimal unitPrice, ReturnReason reason)> returnLines = [];

        foreach (ReturnOrderLineInput lineInput in request.Lines)
        {
            OrderLineEntity? originalLine = order.Lines.FirstOrDefault(l => l.Id.Value == lineInput.LineId);
            if (originalLine is null)
            {
                return PosErrors.OrderLineNotFound;
            }

            if (lineInput.Quantity > originalLine.Quantity)
            {
                return Error.Validation("ReturnOrder.QuantityExceeded",
                    $"Return quantity for line {lineInput.LineId} exceeds the original ordered quantity.");
            }

            returnLines.Add((
                lineInput.LineId,
                originalLine.VariantId,
                originalLine.ProductName,
                originalLine.VariantName,
                lineInput.Quantity,
                originalLine.UnitPrice.Amount,
                lineInput.Reason));
        }

        ErrorOr<ReturnOrderEntity> returnResult = ReturnOrderEntity.Create(
            request.OriginalOrderId,
            order.TenantId,
            request.BranchId,
            order.Currency,
            request.RefundMethod,
            returnLines,
            request.RestockItems);

        if (returnResult.IsError)
        {
            return returnResult.Errors;
        }

        returnOrderRepository.Add(returnResult.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(returnResult.Value);
    }

    private static ReturnOrderResponse MapToResponse(ReturnOrderEntity r) => new(
        r.Id.Value,
        r.OriginalOrderId,
        r.TenantId,
        r.BranchId,
        r.Currency,
        r.RefundAmount,
        r.RefundMethod,
        r.CreatedAt,
        r.Lines.Select(l => new ReturnOrderLineResponse(
            l.Id.Value,
            l.OriginalLineId,
            l.VariantId,
            l.ProductName,
            l.VariantName,
            l.Quantity,
            l.UnitPrice,
            l.LineTotal,
            l.Reason)).ToList());
}
