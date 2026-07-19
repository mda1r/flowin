namespace NexusPOS.IAM.Application.Common;

public sealed record UserSummaryResponse(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string FullName,
    List<string> Roles,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt);
