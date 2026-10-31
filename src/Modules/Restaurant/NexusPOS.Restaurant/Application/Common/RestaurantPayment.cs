using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.Application.Common;

// Taking payment for restaurant orders, shared by paying one order, a whole table, and the quick POS.
internal static class RestaurantPayment
{
    public const string Cash = "Cash";
    public const string Card = "Card";

    // Which of the orders' lines are real menu items. Kitchen copies of cafe sales reuse catalog ids instead.
    public static async Task<HashSet<Guid>> MenuItemIdsAsync(
        RestaurantDbContext dbContext,
        IEnumerable<RestaurantOrder> orders,
        CancellationToken cancellationToken)
    {
        List<MenuItemId> itemIds = [.. orders.SelectMany(o => o.Items).Select(i => new MenuItemId(i.MenuItemId)).Distinct()];
        return [.. await dbContext.MenuItems
            .Where(m => itemIds.Contains(m.Id))
            .Select(m => m.Id.Value)
            .ToListAsync(cancellationToken)];
    }

    // Each order is paid its own total so every sale is settled; the change from cash rides on the last one.
    public static IReadOnlyList<decimal> SplitTender(IReadOnlyList<decimal> totals, decimal amountTendered)
    {
        decimal change = Math.Max(0m, amountTendered - totals.Sum());
        return [.. totals.Select((total, i) => i == totals.Count - 1 ? total + change : total)];
    }

    public static async Task<ErrorOr<Success>> PayAsync(
        RestaurantOrder order,
        string paymentMethod,
        decimal amountTendered,
        IReadOnlySet<Guid> menuItemIds,
        IPublisher publisher,
        CancellationToken cancellationToken)
    {
        // Kitchen copies of cafe sales were already sold, and their stock used, at the cafe till.
        IReadOnlySet<Guid> soldHere = order.IsKitchenCopy ? new HashSet<Guid>() : menuItemIds;
        ErrorOr<Success> result = order.Pay(paymentMethod, amountTendered, soldHere);
        if (result.IsError)
        {
            return result.Errors;
        }

        if (order.Items.Exists(i => soldHere.Contains(i.MenuItemId)))
        {
            // The sale is recorded with prices before VAT. Orders opened before menu prices became
            // VAT-inclusive added VAT on top; their own totals tell which rule they were priced with.
            bool vatInclusive = Math.Abs(order.Total - (order.SubTotal - order.DiscountAmount)) < 0.01m;
            decimal toNet = vatInclusive ? 1 + RestaurantOrder.VatRate : 1m;
            await publisher.Publish(new ExternalSaleCompletedDomainEvent(
                order.TenantId,
                order.BranchId,
                ExternalSaleCompletedDomainEvent.Restaurant,
                order.Id.Value,
                [.. order.Items.Select(i => new ExternalSaleCompletedDomainEvent.Line(
                    i.MenuItemId, i.ItemName, Math.Round(i.UnitPrice / toNet, 4), i.Quantity))],
                Math.Round(order.DiscountAmount / toNet, 4),
                RestaurantOrder.VatRate,
                paymentMethod,
                amountTendered), cancellationToken);
        }

        return Result.Success;
    }
}
