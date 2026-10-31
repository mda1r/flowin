namespace NexusPOS.SharedKernel.Application.Services;

/// <summary>IsActive is false once the platform admin suspends the tenant (e.g. for non-payment).</summary>
public sealed record TenantContext(Guid TenantId, Guid? BranchId, string BusinessType, bool IsActive = true);

public interface ITenantContextResolver
{
    Task<TenantContext?> ResolveAsync(Guid? tenantId, string email, CancellationToken ct);
}
