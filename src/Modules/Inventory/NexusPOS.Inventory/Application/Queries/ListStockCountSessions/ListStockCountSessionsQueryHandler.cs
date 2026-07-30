using ErrorOr;
using NexusPOS.Inventory.Application.Commands.CreateStockCountSession;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockCountSessions;

internal sealed class ListStockCountSessionsQueryHandler(IStockCountRepository stockCountRepository)
    : IQueryHandler<ListStockCountSessionsQuery, IReadOnlyList<StockCountSessionResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<StockCountSessionResponse>>> Handle(
        ListStockCountSessionsQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<StockCountSession> sessions =
            await stockCountRepository.FindByBranchAsync(request.BranchId, cancellationToken);

        return ErrorOrFactory.From<IReadOnlyList<StockCountSessionResponse>>(
            sessions.Select(CreateStockCountSessionCommandHandler.MapToResponse).ToList());
    }
}
