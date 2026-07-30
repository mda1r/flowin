namespace NexusPOS.SharedKernel.Application.Services;

public interface ITenantSubscriptionChecker
{
    Task<int?> GetMaxUsersAsync(Guid tenantId, CancellationToken ct);
    Task<IReadOnlyList<string>> GetFeaturesAsync(Guid tenantId, CancellationToken ct);
}
