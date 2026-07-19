using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.Application.Services;

public interface IJwtService
{
    string GenerateAccessToken(
        UserId userId,
        Email email,
        string firstName,
        string lastName,
        IEnumerable<UserRole> roles,
        Guid? tenantId = null,
        Guid? branchId = null,
        string? businessType = null);
}
