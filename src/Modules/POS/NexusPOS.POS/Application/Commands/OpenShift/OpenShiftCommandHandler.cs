using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
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
        s.Notes, s.OpenedAt, s.ClosedAt);
}
