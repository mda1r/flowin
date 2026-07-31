using ErrorOr;
using NexusPOS.POS.Application.Commands.OpenShift;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.GetCurrentShift;

internal sealed class GetCurrentShiftQueryHandler(IShiftRepository shiftRepository)
    : IQueryHandler<GetCurrentShiftQuery, ShiftResponse?>
{
    public async Task<ErrorOr<ShiftResponse?>> Handle(
        GetCurrentShiftQuery request,
        CancellationToken cancellationToken)
    {
        CashierShift? shift = await shiftRepository.FindOpenByUserAsync(
            request.BranchId, request.UserId, cancellationToken);

        return shift is null ? (ShiftResponse?)null : OpenShiftCommandHandler.ToResponse(shift);
    }
}
