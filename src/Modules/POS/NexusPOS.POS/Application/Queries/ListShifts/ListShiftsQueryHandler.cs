using ErrorOr;
using NexusPOS.POS.Application.Commands.OpenShift;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListShifts;

internal sealed class ListShiftsQueryHandler(IShiftRepository shiftRepository)
    : IQueryHandler<ListShiftsQuery, IReadOnlyList<ShiftResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ShiftResponse>>> Handle(
        ListShiftsQuery request,
        CancellationToken cancellationToken)
    {
        var shifts = await shiftRepository.ListByBranchAsync(
            request.BranchId, request.Page, request.PageSize, cancellationToken);

        return shifts.Select(OpenShiftCommandHandler.ToResponse).ToList();
    }
}
