using ErrorOr;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.Repositories;
using NexusPOS.Inventory.Domain.Services;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetInventoryAlerts;

internal sealed class GetInventoryAlertsQueryHandler(IStockItemRepository stockItemRepository)
    : IQueryHandler<GetInventoryAlertsQuery, InventoryAlertsResponse>
{
    public async Task<ErrorOr<InventoryAlertsResponse>> Handle(
        GetInventoryAlertsQuery request,
        CancellationToken cancellationToken)
    {
        DateTime now = DateTime.UtcNow;

        IReadOnlyList<StockItem> expiringItems = await stockItemRepository
            .FindExpiringAsync(request.BranchId, request.ExpiryDaysAhead, cancellationToken);

        IReadOnlyList<StockItem> lowStockItems = await stockItemRepository
            .FindLowStockAsync(request.BranchId, cancellationToken);

        List<StockAlertItemResponse> expired = [];
        List<StockAlertItemResponse> expiringSoon = [];

        foreach (StockItem item in expiringItems)
        {
            // Calendar days in Riyadh time, so an item expiring today reads 0 and yesterday's reads -1.
            int? daysUntilExpiry = item.ExpiryDate.HasValue
                ? ExpiryCalendar.DaysUntilExpiry(item.ExpiryDate.Value, now)
                : null;

            bool isExpired = daysUntilExpiry < 0;

            StockAlertItemResponse alert = new(
                item.Id.Value,
                item.VariantId,
                item.BranchId,
                item.Quantity,
                item.ReorderPoint,
                item.ExpiryDate,
                daysUntilExpiry,
                isExpired ? "Expired" : "ExpiringSoon");

            if (isExpired)
            {
                expired.Add(alert);
            }
            else
            {
                expiringSoon.Add(alert);
            }
        }

        List<StockAlertItemResponse> lowStock = [.. lowStockItems
            .Select(s => new StockAlertItemResponse(
                s.Id.Value, s.VariantId, s.BranchId,
                s.Quantity, s.ReorderPoint, s.ExpiryDate, null, "LowStock"))];

        InventoryAlertsResponse response = new(
            expired,
            expiringSoon,
            lowStock,
            expired.Count + expiringSoon.Count + lowStock.Count);

        return response;
    }
}
