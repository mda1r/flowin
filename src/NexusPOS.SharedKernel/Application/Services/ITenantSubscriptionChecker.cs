namespace NexusPOS.SharedKernel.Application.Services;

public interface ITenantSubscriptionChecker
{
    Task<int?> GetMaxUsersAsync(Guid tenantId, CancellationToken ct);
}
