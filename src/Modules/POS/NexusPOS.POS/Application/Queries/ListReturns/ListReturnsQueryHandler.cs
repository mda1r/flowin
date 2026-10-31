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

        IReadOnlyList<ReturnOrderResponse> responses = returns
            .Select(r => new ReturnOrderResponse(
                r.Id.Value,
                r.OriginalOrderId,
                r.TenantId,
                r.BranchId,
                r.Currency,
                r.RefundAmount,
                r.RefundMethod,
                r.CreatedAt,
                r.Lines.Select(l => new ReturnOrderLineResponse(
                    l.Id.Value,
                    l.OriginalLineId,
                    l.VariantId,
                    l.ProductName,
                    l.VariantName,
                    l.Quantity,
                    l.UnitPrice,
                    l.LineTotal,
                    l.Reason)).ToList()))
            .ToList();

        return ErrorOrFactory.From(responses);
    }
}
