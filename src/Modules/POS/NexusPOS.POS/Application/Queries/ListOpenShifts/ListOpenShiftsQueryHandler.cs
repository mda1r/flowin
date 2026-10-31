using ErrorOr;
using NexusPOS.POS.Application.Commands.OpenShift;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListOpenShifts;

internal sealed class ListOpenShiftsQueryHandler(
    IShiftRepository shiftRepository,
    PosDbContext dbContext)
    : IQueryHandler<ListOpenShiftsQuery, IReadOnlyList<ShiftResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ShiftResponse>>> Handle(
        ListOpenShiftsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<CashierShift> shifts = await shiftRepository.ListOpenByBranchAsync(
            request.BranchId, cancellationToken);

        // A branch has a handful of open shifts at most; each one's totals are two aggregate queries.
        List<ShiftResponse> result = [];
        foreach (CashierShift shift in shifts)
        {
            ShiftTotals live = await ShiftTotalsReader.ReadAsync(dbContext, shift, cancellationToken);
            result.Add(OpenShiftCommandHandler.ToResponse(shift, live));
        }

        return result;
    }
}
