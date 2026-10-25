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

        ErrorOr<Success> result = shift.Close(
            request.ClosingCash,
            request.ClosingCardCount,
            totalSales,
            totalCashSales,
            totalCardSales,
            totalTax,
            totalOrders,
            request.Notes);

        if (result.IsError)
        {
            return result.Errors;
        }

        shiftRepository.Update(shift);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OpenShiftCommandHandler.ToResponse(shift);
    }
}
