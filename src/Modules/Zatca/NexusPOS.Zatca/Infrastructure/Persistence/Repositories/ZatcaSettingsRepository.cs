using Microsoft.EntityFrameworkCore;
using NexusPOS.Zatca.Domain.Entities;
using NexusPOS.Zatca.Domain.Repositories;
using NexusPOS.Zatca.Infrastructure.Persistence;

namespace NexusPOS.Zatca.Infrastructure.Persistence.Repositories;

internal sealed class ZatcaSettingsRepository(ZatcaDbContext db) : IZatcaSettingsRepository
{
    public async Task<ZatcaSettings?> FindByTenantAsync(Guid tenantId, CancellationToken ct = default) =>
        await db.ZatcaSettings.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);

    public void Add(ZatcaSettings settings) => db.ZatcaSettings.Add(settings);
}
