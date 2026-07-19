namespace NexusPOS.SuperAdmin.Application.Common;

public sealed record TenantWithSubscriptionResponse(
    Guid Id,
    string Name,
    string Subdomain,
    string AdminEmail,
    string Currency,
    string TimeZone,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? SuspendedAt,
    TenantSubscriptionResponse? ActiveSubscription,
    string BusinessType = "Retail",
    string? DefaultPassword = null);
