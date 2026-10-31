using ErrorOr;
using NexusPOS.POS.Application.Commands.OpenShift;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.ListShifts;

internal sealed class ListShiftsQueryHandler(IShiftRepository shiftRepository)
    : IQueryHandler<ListShiftsQuery, IReadOnlyList<ShiftResponse>>
{
    internal const int MaxPageSize = 200;

    public async Task<ErrorOr<IReadOnlyList<ShiftResponse>>> Handle(
        ListShiftsQuery request,
        CancellationToken cancellationToken)
    {
        // page=0 used to give a negative Skip; keep both inside sane bounds.
        int page = Math.Max(1, request.Page);
        int pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        var shifts = await shiftRepository.ListByBranchAsync(
            request.BranchId, page, pageSize, cancellationToken);

        return shifts.Select(OpenShiftCommandHandler.ToResponse).ToList();
    }
}
