using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.ValueObjects;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.CRM.Application.Services;

internal sealed class CustomerLoyaltyDirectory(CrmDbContext db) : ICustomerLoyaltyDirectory
{
    public async Task<int?> GetPointsAsync(Guid tenantId, Guid customerId, CancellationToken cancellationToken = default)
    {
        CustomerId id = new(customerId);
        var customer = await db.Customers
            .Where(c => c.TenantId == tenantId && c.Id == id)
            .Select(c => new { c.LoyaltyPoints })
            .FirstOrDefaultAsync(cancellationToken);
        return customer?.LoyaltyPoints;
    }
}
