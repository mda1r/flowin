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

namespace NexusPOS.POS.Application.Queries.GetShiftSummary;

internal sealed class GetShiftSummaryQueryHandler(
    IShiftRepository shiftRepository,
    PosDbContext dbContext)
    : IQueryHandler<GetShiftSummaryQuery, ShiftResponse>
{
    public async Task<ErrorOr<ShiftResponse>> Handle(
        GetShiftSummaryQuery request,
        CancellationToken cancellationToken)
    {
        CashierShift? shift = await shiftRepository.FindByIdAsync(
            new CashierShiftId(request.ShiftId), cancellationToken);

        if (shift is null || shift.BranchId != request.BranchId
            || (!request.CanSeeAllShifts && shift.UserId != request.UserId))
        {
            return PosErrors.ShiftNotFound;
        }

        if (shift.Status != ShiftStatus.Open)
        {
            return OpenShiftCommandHandler.ToResponse(shift);
        }

        ShiftTotals live = await ShiftTotalsReader.ReadAsync(dbContext, shift, cancellationToken);
        return OpenShiftCommandHandler.ToResponse(shift, live);
    }
}
