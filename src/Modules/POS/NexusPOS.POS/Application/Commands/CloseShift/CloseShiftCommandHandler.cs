using ErrorOr;
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

        if (shift is null || shift.BranchId != request.BranchId
            || (!request.ClosedByManager && shift.UserId != request.UserId))
        {
            return PosErrors.ShiftNotFound;
        }

        if (shift.Status != ShiftStatus.Open)
        {
            return PosErrors.ShiftNotOpen;
        }

        ShiftTotals totals = await ShiftTotalsReader.ReadAsync(dbContext, shift, cancellationToken);

        // A manager closing their own shift is an ordinary close; only someone else's is marked.
        string? closedBy = request.ClosedByManager && shift.UserId != request.UserId ? request.ClosedByName : null;

        ErrorOr<Success> result = shift.Close(
            request.ClosingCash,
            request.ClosingCardCount,
            totals,
            request.Notes,
            closedBy);

        if (result.IsError)
        {
            return result.Errors;
        }

        shiftRepository.Update(shift);
        await dbContext.SaveChangesAsync(cancellationToken);

        return OpenShiftCommandHandler.ToResponse(shift);
    }
}
