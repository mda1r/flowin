using ErrorOr;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using ReturnOrderEntity = NexusPOS.POS.Domain.Entities.ReturnOrder;

namespace NexusPOS.POS.Application.Queries.ListReturns;

internal sealed class ListReturnsQueryHandler(IReturnOrderRepository returnOrderRepository)
    : IQueryHandler<ListReturnsQuery, IReadOnlyList<ReturnOrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ReturnOrderResponse>>> Handle(
        ListReturnsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ReturnOrderEntity> returns = await returnOrderRepository
            .FindByBranchAsync(request.BranchId, cancellationToken);

        IReadOnlyList<ReturnOrderResponse> responses = [.. returns.Select(ReturnOrderMapper.ToResponse)];

        return ErrorOrFactory.From(responses);
    }
}
