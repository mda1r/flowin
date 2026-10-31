using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using ReturnOrderEntity = NexusPOS.POS.Domain.Entities.ReturnOrder;

namespace NexusPOS.POS.Application.Queries.ListReturns;

internal sealed class ListReturnsQueryHandler(IReturnOrderRepository returnOrderRepository, PosDbContext dbContext)
    : IQueryHandler<ListReturnsQuery, IReadOnlyList<ReturnOrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ReturnOrderResponse>>> Handle(
        ListReturnsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ReturnOrderEntity> returns = await returnOrderRepository
            .FindByBranchAsync(request.BranchId, cancellationToken);

        // Unit costs of the sale lines these returns came from, so reports can reverse the cost of goods.
        List<OrderLineId> lineIds = returns
            .SelectMany(r => r.Lines)
            .Select(l => new OrderLineId(l.OriginalLineId))
            .Distinct()
            .ToList();

        Dictionary<Guid, decimal> lineCosts = lineIds.Count == 0
            ? []
            : (await dbContext.OrderLines
                .AsNoTracking()
                .Where(l => lineIds.Contains(l.Id))
                .Select(l => new { l.Id, l.CostPrice })
                .ToListAsync(cancellationToken))
                .ToDictionary(l => l.Id.Value, l => l.CostPrice);

        IReadOnlyList<ReturnOrderResponse> responses = returns
            .Select(r => ReturnOrderMapper.ToResponse(r, lineCosts))
            .ToList();

        return ErrorOrFactory.From(responses);
    }
}
