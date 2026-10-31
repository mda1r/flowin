using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using OrderEntity = NexusPOS.POS.Domain.Entities.Order;
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
        // One return per sale at a time: a double-click or a retry waits here, then sees what the first one saved.
        string lockKey = $"return:{request.OriginalOrderId}";
        await dbContext.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await dbContext.Database.ExecuteSqlAsync(
                $"SELECT pg_advisory_lock(hashtextextended({lockKey}, 0))", cancellationToken);
            try
            {
                return await ProcessAsync(request, cancellationToken);
            }
            finally
            {
                await dbContext.Database.ExecuteSqlAsync(
                    $"SELECT pg_advisory_unlock(hashtextextended({lockKey}, 0))", CancellationToken.None);
            }
        }
        finally
        {
            await dbContext.Database.CloseConnectionAsync();
        }
    }

    private async Task<ErrorOr<ReturnOrderResponse>> ProcessAsync(
        ReturnOrderCommand request,
        CancellationToken cancellationToken)
    {
        if (request.ClientReference is Guid reference)
        {
            ReturnOrderEntity? replay = await returnOrderRepository.FindByClientReferenceAsync(reference, cancellationToken);
            if (replay is not null)
            {
                return replay.OriginalOrderId == request.OriginalOrderId && replay.BranchId == request.BranchId
                    ? ReturnOrderMapper.ToResponse(replay)
                    : Error.Conflict("ReturnOrder.ReferenceInUse", "This return reference belongs to another sale.");
            }
        }

        OrderEntity? order = await orderRepository.FindByIdAsync(
            new OrderId(request.OriginalOrderId), cancellationToken);

        if (order is null || order.BranchId != request.BranchId)
        {
            return PosErrors.OrderNotFound;
        }

        IReadOnlyList<ReturnOrderEntity> existingReturns = await returnOrderRepository
            .FindByOriginalOrderAsync(request.OriginalOrderId, cancellationToken);

        Guid? shiftId = await FindShiftIdAsync(request.BranchId, request.UserId, cancellationToken);

        ErrorOr<ReturnOrderEntity> returnResult = ReturnOrderEntity.Create(
            order,
            existingReturns,
            request.Lines.Select(l => (l.LineId, l.Quantity, l.Reason)),
            request.RefundMethod,
            request.RestockItems,
            request.UserId,
            request.UserName,
            shiftId,
            request.Note,
            request.ClientReference);

        if (returnResult.IsError)
        {
            return returnResult.Errors;
        }

        returnOrderRepository.Add(returnResult.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ReturnOrderMapper.ToResponse(returnResult.Value);
    }

    // The refund comes out of the drawer of whoever gives it, or else the branch's latest open shift.
    private async Task<Guid?> FindShiftIdAsync(Guid branchId, Guid? userId, CancellationToken cancellationToken)
    {
        List<CashierShift> open = await dbContext.CashierShifts
            .AsNoTracking()
            .Where(s => s.BranchId == branchId && s.Status == ShiftStatus.Open)
            .ToListAsync(cancellationToken);

        CashierShift? shift = open.Find(s => s.UserId == userId) ?? open.MaxBy(s => s.OpenedAt);
        return shift?.Id.Value;
    }
}
