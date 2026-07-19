namespace NexusPOS.SharedKernel.Application.Services;

public interface IUserProvisioningService
{
    Task<string> CreateTenantAdminAsync(string email, string firstName, string lastName, Guid tenantId, CancellationToken ct);
    Task DeactivateAllTenantUsersAsync(Guid tenantId, CancellationToken ct);
}
