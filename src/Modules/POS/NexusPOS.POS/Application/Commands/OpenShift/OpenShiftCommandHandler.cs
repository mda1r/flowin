using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.OpenShift;

internal sealed class OpenShiftCommandHandler(
    IShiftRepository shiftRepository,
    PosDbContext dbContext)
    : ICommandHandler<OpenShiftCommand, ShiftResponse>
{
    public async Task<ErrorOr<ShiftResponse>> Handle(
        OpenShiftCommand request,
        CancellationToken cancellationToken)
    {
        CashierShift? existing = await shiftRepository.FindOpenByUserAsync(
            request.BranchId, request.UserId, cancellationToken);

        if (existing is not null)
        {
            return PosErrors.ShiftAlreadyOpen;
        }

        CashierShift shift = CashierShift.Open(
            request.BranchId,
            request.UserId,
            request.CashierName,
            request.OpeningCash);

        shiftRepository.Add(shift);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToResponse(shift);
    }

    internal static ShiftResponse ToResponse(CashierShift s) => new(
        s.Id.Value, s.BranchId, s.UserId, s.CashierName, s.Status,
        s.OpeningCash, s.ClosingCash,
        s.TotalSales, s.TotalCashSales, s.TotalCardSales, s.TotalTax, s.TotalOrders,
        s.ExpectedCash, s.CashVariance, s.ClosingCardCount, s.CardVariance,
        s.Notes, s.OpenedAt, s.ClosedAt,
        s.TotalDigitalSales, s.TotalCashRefunds, s.ClosedByName, s.TotalRefunds);

    // An open shift's stored totals stay zero until it closes, so its live figures are passed in.
    internal static ShiftResponse ToResponse(CashierShift s, ShiftTotals live) => ToResponse(s) with
    {
        TotalSales = live.TotalSales,
        TotalCashSales = live.CashSales,
        TotalCardSales = live.CardSales,
        TotalDigitalSales = live.DigitalSales,
        TotalCashRefunds = live.CashRefunds,
        TotalRefunds = live.TotalRefunds,
        TotalTax = live.Tax,
        TotalOrders = live.Orders,
        ExpectedCash = s.ExpectedCashFor(live),
    };
}
