using NexusPOS.Zatca.Domain.Entities;

namespace NexusPOS.Zatca.Domain.Repositories;

public interface IZatcaSettingsRepository
{
    Task<ZatcaSettings?> FindByTenantAsync(Guid tenantId, CancellationToken ct = default);
    void Add(ZatcaSettings settings);
}
