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
        if (request.DateFrom > request.DateTo)
        {
            return Error.Validation("Returns.InvalidDateRange", "The start of the date range must be before its end.");
        }

        IReadOnlyList<ReturnOrderEntity> returns = await returnOrderRepository
            .FindByBranchAsync(request.BranchId, request.DateFrom, request.DateTo, cancellationToken);

        // Unit costs of the sale lines these returns came from, so reports can reverse the cost of goods.
        IReadOnlyDictionary<Guid, decimal> lineCosts = await returnOrderRepository.FindOriginalLineCostsAsync(
            [.. returns.SelectMany(r => r.Lines).Select(l => l.OriginalLineId).Distinct()], cancellationToken) ?? new Dictionary<Guid, decimal>();

        IReadOnlyList<ReturnOrderResponse> responses = returns
            .Select(r => ReturnOrderMapper.ToResponse(r, lineCosts))
            .ToList();

        return ErrorOrFactory.From(responses);
    }
}
