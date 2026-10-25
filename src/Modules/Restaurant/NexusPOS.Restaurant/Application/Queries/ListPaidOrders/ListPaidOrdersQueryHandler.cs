using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListPaidOrders;

internal sealed class ListPaidOrdersQueryHandler(RestaurantDbContext db)
    : IQueryHandler<ListPaidOrdersQuery, IReadOnlyList<RestaurantOrderResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<RestaurantOrderResponse>>> Handle(
        ListPaidOrdersQuery request, CancellationToken cancellationToken)
    {
        var orders = await db.RestaurantOrders
            .Include(o => o.Items)
            .Where(o => o.BranchId == request.BranchId
                && o.Status == RestaurantOrderStatus.Paid
                && o.PaidAt >= request.From
                && o.PaidAt < request.To)
            .OrderBy(o => o.PaidAt)
            .Take(2000)
            .ToListAsync(cancellationToken);

        return orders.Select(RestaurantOrderMapper.ToResponse).ToList();
    }
}
