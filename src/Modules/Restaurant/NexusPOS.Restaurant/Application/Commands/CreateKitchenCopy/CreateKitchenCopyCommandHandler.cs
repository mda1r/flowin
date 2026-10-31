using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.Application.Commands.CreateKitchenCopy;

internal sealed class CreateKitchenCopyCommandHandler(
    IRestaurantOrderRepository orderRepository,
    IPosSaleDirectory posSales,
    RestaurantDbContext dbContext,
    ITenantContext tenantContext)
    : ICommandHandler<CreateKitchenCopyCommand, RestaurantOrderResponse>
{
    public async Task<ErrorOr<RestaurantOrderResponse>> Handle(
        CreateKitchenCopyCommand request,
        CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return Error.Unauthorized("Restaurant.NoTenant", "Tenant context is required.");
        }

        // The copy takes the sale's id, so each sale reaches the kitchen once and a resent copy is the same one.
        RestaurantOrder? existing = await orderRepository.FindByIdAsync(new RestaurantOrderId(request.PosOrderId), cancellationToken);
        if (existing is not null)
        {
            return existing.IsKitchenCopy && existing.BranchId == request.BranchId
                ? RestaurantOrderMapper.ToResponse(existing)
                : RestaurantErrors.OrderIdTaken;
        }

        // Only a sale completed at this branch's till can be copied, so nothing reaches the kitchen unpaid.
        IReadOnlyList<PosSaleLine>? sale = await posSales.GetCompletedSaleLinesAsync(
            request.BranchId, request.PosOrderId, cancellationToken);
        if (sale is null || sale.Count == 0)
        {
            return RestaurantErrors.KitchenCopyWithoutSale;
        }

        ErrorOr<RestaurantOrder> orderResult = RestaurantOrder.Create(
            tenantId,
            request.BranchId,
            request.TableNumber,
            Lines(sale, request.ItemNotes),
            request.Notes,
            discountCode: null,
            discountAmount: 0m,
            isKitchenCopy: true,
            id: request.PosOrderId);

        if (orderResult.IsError)
        {
            return orderResult.Errors;
        }

        orderRepository.Add(orderResult.Value);
        ErrorOr<Success> saved = await RestaurantSave.SaveAsync(dbContext, RestaurantErrors.OrderChanged, cancellationToken);
        if (saved.IsError)
        {
            return saved.Errors;
        }

        return RestaurantOrderMapper.ToResponse(orderResult.Value);
    }

    // The sale's lines as the kitchen sees them, each with the cook's note the till gave for that item.
    internal static IEnumerable<(Guid MenuItemId, string ItemName, int Quantity, decimal UnitPrice, string? Notes)> Lines(
        IReadOnlyList<PosSaleLine> sale,
        IReadOnlyList<KitchenCopyNoteInput>? itemNotes)
    {
        Dictionary<Guid, string> notes = (itemNotes ?? [])
            .Where(n => !string.IsNullOrWhiteSpace(n.Notes))
            .GroupBy(n => n.CatalogItemId)
            .ToDictionary(g => g.Key, g => g.First().Notes!.Trim());

        return sale.Select(l => (
            l.ItemId,
            l.Name,
            (int)Math.Ceiling(l.Quantity),
            l.UnitPrice,
            notes.TryGetValue(l.ItemId, out string? note) ? note : null));
    }
}
