namespace NexusPOS.IAM.Application.Common;

public sealed record CurrentUserResponse(
    string Id,
    string Email,
    string FirstName,
    string LastName,
    string Role,
    string? TenantId,
    string? BranchId,
    string? BusinessType);
