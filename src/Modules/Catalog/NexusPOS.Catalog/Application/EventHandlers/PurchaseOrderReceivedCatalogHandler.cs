using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Catalog.Application.EventHandlers;

// Last-purchase costing: a received purchase order sets each product's cost to what was paid
// (quantity-weighted when one order has several lines for the same product). Failures are logged only.
internal sealed class PurchaseOrderReceivedCatalogHandler(
    CatalogDbContext db,
    ILogger<PurchaseOrderReceivedCatalogHandler> logger)
    : INotificationHandler<PurchaseOrderReceivedDomainEvent>
{
    public async Task Handle(PurchaseOrderReceivedDomainEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            Dictionary<Guid, decimal> unitCosts = notification.ReceivedItems
                .Where(i => i.VariantId != Guid.Empty && i.Quantity > 0 && i.UnitCost >= 0)
                .GroupBy(i => i.VariantId)
                .ToDictionary(
                    g => g.Key,
                    g => Math.Round(g.Sum(i => i.Quantity * i.UnitCost) / g.Sum(i => i.Quantity), 4));
            if (unitCosts.Count == 0)
            {
                return;
            }

            List<VariantId> variantIds = [.. unitCosts.Keys.Select(id => new VariantId(id))];
            List<Product> products = await db.Products
                .Include(p => p.Variants)
                .Where(p => p.Variants.Any(v => variantIds.Contains(v.Id)))
                .ToListAsync(cancellationToken);

            foreach (Product product in products)
            {
                foreach (ProductVariant variant in product.Variants.Where(v => unitCosts.ContainsKey(v.Id.Value)))
                {
                    product.ApplyPurchaseCost(variant.Id, unitCosts[variant.Id.Value], notification.ReceivedAt);
                }
            }

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            db.ChangeTracker.Clear();
            logger.LogError(ex, "Failed to update product costs for purchase order {OrderId} in tenant {TenantId}",
                notification.PurchaseOrderId, notification.TenantId);
        }
    }
}
