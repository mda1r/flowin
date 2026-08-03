namespace NexusPOS.SharedKernel.Infrastructure.Persistence;

public interface ITenantSchemaProvisioner
{
    Task ProvisionAsync(Guid tenantId, CancellationToken ct = default);
}
