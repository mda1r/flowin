using ErrorOr;
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

    // Which of the orders' lines are real menu items.
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

    // Marks the order paid and returns the sale to record for it (none when it has no menu items). Nothing is
    // published here: the caller records the sales with the paid orders, see RestaurantSave.SaveWithSalesAsync.
    public static ErrorOr<IReadOnlyList<ExternalSaleCompletedDomainEvent>> Pay(
        RestaurantOrder order,
        string paymentMethod,
        decimal amountTendered,
        IReadOnlySet<Guid> menuItemIds)
    {
        ErrorOr<Success> result = order.Pay(paymentMethod, amountTendered, menuItemIds);
        if (result.IsError)
        {
            return result.Errors;
        }

        List<ExternalSaleCompletedDomainEvent> sales = [];
        if (!order.Items.Exists(i => menuItemIds.Contains(i.MenuItemId)))
        {
            return sales;
        }

        // The sale is recorded with prices before VAT. Orders opened before menu prices became
        // VAT-inclusive added VAT on top; their own totals tell which rule they were priced with.
        bool vatInclusive = Math.Abs(order.Total - (order.SubTotal - order.DiscountAmount)) < 0.01m;
        decimal toNet = vatInclusive ? 1 + order.TaxRate : 1m;
        sales.Add(new ExternalSaleCompletedDomainEvent(
            order.TenantId,
            order.BranchId,
            ExternalSaleCompletedDomainEvent.Restaurant,
            order.Id.Value,
            [.. order.Items.Select(i => new ExternalSaleCompletedDomainEvent.Line(
                i.MenuItemId, i.ItemName, Math.Round(i.UnitPrice / toNet, 4), i.Quantity))],
            Math.Round(order.DiscountAmount / toNet, 4),
            order.TaxRate,
            paymentMethod,
            amountTendered));
        return sales;
    }
}
