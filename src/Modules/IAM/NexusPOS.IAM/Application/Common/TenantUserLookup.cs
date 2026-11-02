using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Persistence;

namespace NexusPOS.IAM.Application.Common;

internal static class TenantUserLookup
{
    /// <summary>Loads a user of the given tenant (with refresh tokens, so they can be revoked).</summary>
    public static Task<User?> FindTenantUserAsync(
        this IamDbContext db, Guid tenantId, Guid userId, CancellationToken cancellationToken)
    {
        var id = new UserId(userId);
        return db.Users
            .Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, cancellationToken);
    }

    public static async Task<int> CountActiveOwnersAsync(
        this IamDbContext db, Guid tenantId, CancellationToken cancellationToken)
    {
        List<List<UserRole>> roles = await db.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.IsActive)
            .Select(u => u.Roles)
            .ToListAsync(cancellationToken);

        return roles.Count(r => r.Contains(UserRole.Owner));
    }

    public static UserSummaryResponse ToSummary(this User user) => new(
        user.Id.Value,
        user.Email.Value,
        user.FirstName,
        user.LastName,
        user.FullName,
        user.Roles.Select(r => r.ToString()).ToList(),
        user.IsActive,
        user.CreatedAt,
        user.LastLoginAt,
        user.AllowedPages);
}
