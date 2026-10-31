using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Domain;
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

        // Aggregate quantities already returned for each line
        IReadOnlyList<ReturnOrderEntity> existingReturns = await returnOrderRepository
            .FindByOriginalOrderAsync(request.OriginalOrderId, cancellationToken);

        Dictionary<Guid, decimal> alreadyReturned = existingReturns
            .SelectMany(r => r.Lines)
            .GroupBy(l => l.OriginalLineId)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.Quantity));

        // Build return line tuples by matching requested lineIds to the order lines
        List<(Guid lineId, Guid variantId, string productName, string variantName, decimal quantity, decimal unitPrice, ReturnReason reason)> returnLines = [];

        foreach (ReturnOrderLineInput lineInput in request.Lines)
        {
            OrderLineEntity? originalLine = order.Lines.FirstOrDefault(l => l.Id.Value == lineInput.LineId);
            if (originalLine is null)
            {
                return PosErrors.OrderLineNotFound;
            }

            decimal previouslyReturned = alreadyReturned.GetValueOrDefault(lineInput.LineId, 0m);
            decimal remainingReturnable = originalLine.Quantity - previouslyReturned;

            if (lineInput.Quantity > remainingReturnable)
            {
                return Error.Validation("ReturnOrder.QuantityExceeded",
                    $"Return quantity for line {lineInput.LineId} exceeds the remaining returnable quantity ({remainingReturnable}).");
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
            request.RestockItems,
            order.TaxRate,
            LoyaltyContext(order, existingReturns, returnLines));

        if (returnResult.IsError)
        {
            return returnResult.Errors;
        }

        returnOrderRepository.Add(returnResult.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(returnResult.Value);
    }

    // What CRM needs to reverse the sale's loyalty points. The returned share is measured on the lines' net value
    // (after line discounts), so a partial return takes back only its part of the points.
    private static ReturnOrderCompletedDomainEvent.CustomerLoyalty? LoyaltyContext(
        OrderEntity order,
        IReadOnlyList<ReturnOrderEntity> existingReturns,
        IEnumerable<(Guid lineId, Guid variantId, string productName, string variantName, decimal quantity, decimal unitPrice, ReturnReason reason)> returnLines)
    {
        if (order.CustomerId is not Guid customerId)
        {
            return null;
        }

        Dictionary<Guid, OrderLineEntity> linesById = order.Lines.ToDictionary(l => l.Id.Value);
        decimal NetValue(Guid lineId, decimal quantity)
        {
            return linesById.TryGetValue(lineId, out OrderLineEntity? line) && line.Quantity > 0
                ? line.LineTotal / line.Quantity * quantity
                : 0m;
        }

        decimal returnedNet =
            existingReturns.SelectMany(r => r.Lines).Sum(l => NetValue(l.OriginalLineId, l.Quantity)) +
            returnLines.Sum(l => NetValue(l.lineId, l.quantity));
        decimal share = order.SubtotalAmount > 0 ? Math.Clamp(returnedNet / order.SubtotalAmount, 0m, 1m) : 1m;

        return new ReturnOrderCompletedDomainEvent.CustomerLoyalty(
            customerId,
            order.TotalAmount,
            order.LoyaltyPointsRedeemed,
            LoyaltyRules.ValueOf(order.LoyaltyPointsRedeemed, order.LoyaltyPointValue),
            share,
            existingReturns.Sum(r => r.RefundAmount),
            order.CompletedAt);
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
