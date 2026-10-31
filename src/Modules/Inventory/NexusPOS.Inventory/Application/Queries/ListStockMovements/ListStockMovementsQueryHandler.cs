using ErrorOr;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.ValueObjects;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockMovements;

// The stock card of one item: its movements newest first. Sale rows carry the order id as their reference,
// which is resolved to the store's invoice number so the UI can show the same number as the receipt.
internal sealed class ListStockMovementsQueryHandler(
    IStockItemRepository stockItemRepository,
    PosDbContext posDb,
    ILogger<ListStockMovementsQueryHandler> logger)
    : IQueryHandler<ListStockMovementsQuery, StockMovementsPageResponse>
{
    private const int MaxPageSize = 100;

    public async Task<ErrorOr<StockMovementsPageResponse>> Handle(
        ListStockMovementsQuery request,
        CancellationToken cancellationToken)
    {
        StockItemId stockItemId = new(request.StockItemId);
        StockItem? stockItem = await stockItemRepository.FindByIdAsync(stockItemId, cancellationToken);
        if (stockItem is null || stockItem.BranchId != request.BranchId)
        {
            return InventoryErrors.StockItemNotFound;
        }

        int page = Math.Max(request.Page, 1);
        int pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        (IReadOnlyList<StockMovement> movements, int total) = await stockItemRepository.FindMovementsAsync(
            stockItemId, request.Type, request.FromUtc, request.ToUtc, page, pageSize, cancellationToken);

        Dictionary<Guid, long> invoiceNumbers = await FindInvoiceNumbersAsync(movements, cancellationToken);

        List<StockMovementResponse> items = [.. movements.Select(m => new StockMovementResponse(
            m.Id.Value, m.Type, m.Quantity, m.QuantityBefore, m.QuantityAfter, m.Reference, m.Notes, m.OccurredAt,
            m.UserId,
            m.Type == MovementType.Sale && Guid.TryParse(m.Reference, out Guid orderId)
                && invoiceNumbers.TryGetValue(orderId, out long number) ? number : null))];

        return new StockMovementsPageResponse(items, page, pageSize, total);
    }

    private async Task<Dictionary<Guid, long>> FindInvoiceNumbersAsync(
        IReadOnlyList<StockMovement> movements, CancellationToken cancellationToken)
    {
        List<OrderId> orderIds = [.. movements
            .Where(m => m.Type == MovementType.Sale)
            .Select(m => Guid.TryParse(m.Reference, out Guid id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .Select(id => new OrderId(id))];
        if (orderIds.Count == 0)
        {
            return [];
        }

        // The invoice number is a nicety; the stock card still loads if the lookup fails.
        try
        {
            var rows = await posDb.Orders
                .AsNoTracking()
                .Where(o => orderIds.Contains(o.Id) && o.Number != null)
                .Select(o => new { o.Id, o.Number })
                .ToListAsync(cancellationToken);
            return rows.ToDictionary(r => r.Id.Value, r => r.Number!.Value);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not resolve invoice numbers for stock movements");
            return [];
        }
    }
}
