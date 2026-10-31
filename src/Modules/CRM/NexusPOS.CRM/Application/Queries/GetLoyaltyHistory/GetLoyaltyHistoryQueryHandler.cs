using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Domain;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.ValueObjects;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Queries.GetLoyaltyHistory;

// Newest first, so the latest change to the balance is at the top.
internal sealed class GetLoyaltyHistoryQueryHandler(CrmDbContext db)
    : IQueryHandler<GetLoyaltyHistoryQuery, IReadOnlyList<LoyaltyTransactionResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<LoyaltyTransactionResponse>>> Handle(
        GetLoyaltyHistoryQuery request,
        CancellationToken cancellationToken)
    {
        CustomerId id = new(request.CustomerId);
        bool exists = await db.Customers
            .AnyAsync(c => c.TenantId == request.TenantId && c.Id == id, cancellationToken);
        if (!exists)
        {
            return CrmErrors.CustomerNotFound;
        }

        int limit = Math.Clamp(request.Limit, 1, 200);
        List<LoyaltyTransaction> rows = await db.LoyaltyTransactions
            .AsNoTracking()
            .Where(t => t.TenantId == request.TenantId && t.CustomerId == request.CustomerId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return rows
            .Select(t => new LoyaltyTransactionResponse(
                t.Id, t.Delta, t.Kind.ToString(), t.OrderId, t.UserId, t.Reason, t.CreatedAt))
            .ToList();
    }
}
