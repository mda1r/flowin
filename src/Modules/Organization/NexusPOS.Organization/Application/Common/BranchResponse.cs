using NexusPOS.Organization.Domain.Enums;

namespace NexusPOS.Organization.Application.Common;

public sealed record BranchResponse(
    Guid Id,
    Guid TenantId,
    string Name,
    BranchType Type,
    bool IsActive,
    bool IsMainBranch,
    DateTime CreatedAt,
    string? PhoneNumber,
    string? Email,
    string? Street,
    string? City,
    string? State,
    string? Country,
    string? PostalCode);
