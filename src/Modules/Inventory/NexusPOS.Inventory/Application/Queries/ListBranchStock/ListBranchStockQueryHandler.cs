using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListBranchStock;

internal sealed class ListBranchStockQueryHandler(IStockItemRepository stockItemRepository)
    : IQueryHandler<ListBranchStockQuery, IReadOnlyList<StockItemResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<StockItemResponse>>> Handle(
        ListBranchStockQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<StockItem> items = request.LowStockOnly
            ? await stockItemRepository.FindLowStockAsync(request.BranchId, cancellationToken)
            : await stockItemRepository.FindByBranchAsync(request.BranchId, request.IncludeArchived, cancellationToken);

        IReadOnlyList<StockItemResponse> responses = [.. items.Select(StockItemResponse.From)];

        return ErrorOrFactory.From(responses);
    }
}
