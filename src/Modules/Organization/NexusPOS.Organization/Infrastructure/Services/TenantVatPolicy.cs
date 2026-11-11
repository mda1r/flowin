using Microsoft.EntityFrameworkCore;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.Organization.Infrastructure.Services;

internal sealed class TenantVatPolicy(OrganizationDbContext db) : ITenantVatPolicy
{
    // Read once per request: a sale may ask more than once.
    private readonly Dictionary<Guid, bool> _cache = [];

    public async Task<bool> IsVatEnabledAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(tenantId, out bool cached))
        {
            return cached;
        }

        var id = new TenantId(tenantId);
        bool? enabled = await db.Tenants
            .AsNoTracking()
            .Where(t => t.Id == id)
            .Select(t => (bool?)t.VatEnabled)
            .FirstOrDefaultAsync(cancellationToken);

        // An unknown tenant keeps the safe default: VAT is charged.
        return _cache[tenantId] = enabled ?? true;
    }
}
