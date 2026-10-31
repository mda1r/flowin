using NexusPOS.IAM.Domain.Enums;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.IAM.Application.Services;

public static class TenantAccessPolicy
{
    /// <summary>
    /// A suspended tenant cannot sign in or refresh tokens. Platform super-admins are never blocked,
    /// so a suspension can't lock the console out.
    /// </summary>
    public static bool IsBlocked(TenantContext? tenant, IReadOnlyCollection<UserRole> roles) =>
        tenant is { IsActive: false } && !roles.Contains(UserRole.SuperAdmin);
}
