using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.ValueObjects;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;

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

    public Task<LoyaltyRules> GetRulesAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        LoadRulesAsync(db, tenantId, cancellationToken);

    internal static async Task<LoyaltyRules> LoadRulesAsync(CrmDbContext db, Guid tenantId, CancellationToken ct)
    {
        Domain.Entities.LoyaltySettings? settings = await db.LoyaltySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);
        return settings?.ToRules() ?? LoyaltyRules.Default;
    }
}
