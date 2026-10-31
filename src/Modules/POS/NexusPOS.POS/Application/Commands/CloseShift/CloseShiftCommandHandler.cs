using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Commands.OpenShift;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using ReturnOrderEntity = NexusPOS.POS.Domain.Entities.ReturnOrder;

namespace NexusPOS.POS.Application.Commands.CloseShift;

internal sealed class CloseShiftCommandHandler(
    IShiftRepository shiftRepository,
    PosDbContext dbContext)
    : ICommandHandler<CloseShiftCommand, ShiftResponse>
{
    public async Task<ErrorOr<ShiftResponse>> Handle(
        CloseShiftCommand request,
        CancellationToken cancellationToken)
    {
        CashierShift? shift = await shiftRepository.FindByIdAsync(
            new CashierShiftId(request.ShiftId), cancellationToken);

        if (shift is null || shift.BranchId != request.BranchId || shift.UserId != request.UserId)
        {
            return PosErrors.ShiftNotFound;
        }

        // Calculate totals from completed orders during this shift's time range
        List<Order> orders = await dbContext.Orders
            .Where(o => o.BranchId == request.BranchId
                     && o.Status == OrderStatus.Completed
                     && o.CompletedAt >= shift.OpenedAt)
            .ToListAsync(cancellationToken);

        decimal totalSales = orders.Sum(o => o.TotalAmount);
        // Split payments count their cash and card portions; leaving them out understated expected cash.
        decimal totalCashSales = orders.Sum(o => o.PaymentMethod switch
        {
            PaymentMethod.Cash => o.TotalAmount,
            PaymentMethod.Split => o.SplitCash ?? 0m,
            _ => 0m,
        });
        decimal totalCardSales = orders.Sum(o => o.PaymentMethod switch
        {
            PaymentMethod.Card => o.TotalAmount,
            PaymentMethod.Split => o.SplitCard ?? 0m,
            _ => 0m,
        });
        decimal totalTax = orders.Sum(o => o.TaxAmount);
        int totalOrders = orders.Count;
        ShiftRefunds refunds = await RefundsSinceAsync(request.BranchId, shift.OpenedAt, cancellationToken);

        ErrorOr<Success> result = shift.Close(
            request.ClosingCash,
            request.ClosingCardCount,
            totalSales,
            totalCashSales,
            totalCardSales,
            totalTax,
            totalOrders,
            request.Notes,
            refunds);

        if (result.IsError)
        {
            return result.Errors;
        }

        shiftRepository.Update(shift);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OpenShiftCommandHandler.ToResponse(shift);
    }

    // Returns given in the branch over the same window as the sales above, with the VAT each one handed back.
    private async Task<ShiftRefunds> RefundsSinceAsync(Guid branchId, DateTime openedAt, CancellationToken cancellationToken)
    {
        List<ReturnOrderEntity> returns = await dbContext.ReturnOrders
            .AsNoTracking()
            .Where(r => r.BranchId == branchId && r.CreatedAt >= openedAt)
            .ToListAsync(cancellationToken);

        if (returns.Count == 0)
        {
            return ShiftRefunds.None;
        }

        List<OrderId> orderIds = [.. returns.Select(r => new OrderId(r.OriginalOrderId)).Distinct()];
        Dictionary<Guid, decimal> taxRates = await dbContext.Orders
            .AsNoTracking()
            .Where(o => orderIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id.Value, o => o.TaxRate, cancellationToken);

        return new ShiftRefunds(
            returns.Sum(r => r.RefundAmount),
            returns.Where(r => r.RefundMethod == RefundMethod.Cash).Sum(r => r.RefundAmount),
            returns.Where(r => r.RefundMethod == RefundMethod.Card).Sum(r => r.RefundAmount),
            returns.Sum(r => ReturnOrderEntity.RefundTaxOf(r.RefundAmount, taxRates.GetValueOrDefault(r.OriginalOrderId, 0m))));
    }
}
