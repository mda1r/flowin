using NexusPOS.Organization.Domain.Enums;

namespace NexusPOS.Organization.Application.Common;

public sealed record TenantResponse(
    Guid Id,
    string Name,
    string Subdomain,
    string AdminEmail,
    SubscriptionPlan Plan,
    bool IsActive,
    DateTime CreatedAt,
    string Currency,
    string TimeZone,
    string? LogoUrl,
    string? PhoneNumber,
    string? TaxId);
