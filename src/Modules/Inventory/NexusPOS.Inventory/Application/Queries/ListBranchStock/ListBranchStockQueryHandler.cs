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
            : await stockItemRepository.FindByBranchAsync(request.BranchId, cancellationToken);

        IReadOnlyList<StockItemResponse> responses = items.Select(s => new StockItemResponse(
            s.Id.Value, s.VariantId, s.BranchId,
            s.Quantity, s.ReorderPoint, s.ReorderQuantity,
            s.Quantity <= s.ReorderPoint && s.ReorderPoint > 0,
            s.UpdatedAt, s.ExpiryDate)).ToList();

        return ErrorOrFactory.From(responses);
    }
}
