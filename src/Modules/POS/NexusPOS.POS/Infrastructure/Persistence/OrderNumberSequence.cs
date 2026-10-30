using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Common;

namespace NexusPOS.POS.Infrastructure.Persistence;

internal sealed class OrderNumberSequence(PosDbContext db) : IOrderNumberSequence
{
    // One statement: the first call starts after the highest number already given, every later call adds one.
    public async Task<long> NextAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        List<long> next = await db.Database.SqlQuery<long>($"""
            INSERT INTO order_number_counters (tenant_id, last_number)
            VALUES ({tenantId}, (SELECT COALESCE(MAX(number), 0) FROM orders) + 1)
            ON CONFLICT (tenant_id) DO UPDATE SET last_number = order_number_counters.last_number + 1
            RETURNING last_number AS "Value"
            """).ToListAsync(cancellationToken);
        return next[0];
    }
}
