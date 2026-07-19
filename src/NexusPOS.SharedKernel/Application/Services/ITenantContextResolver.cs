namespace NexusPOS.SharedKernel.Application.Services;

public sealed record TenantContext(Guid TenantId, Guid? BranchId, string BusinessType);

public interface ITenantContextResolver
{
    Task<TenantContext?> ResolveAsync(Guid? tenantId, string email, CancellationToken ct);
}
