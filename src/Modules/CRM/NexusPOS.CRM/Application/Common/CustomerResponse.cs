namespace NexusPOS.CRM.Application.Common;

public sealed record CustomerResponse(
    Guid Id,
    Guid TenantId,
    string Name,
    string? Email,
    string? Phone,
    string? Address,
    DateOnly? DateOfBirth,
    int LoyaltyPoints,
    string? Notes,
    bool IsActive,
    DateTime CreatedAt);
