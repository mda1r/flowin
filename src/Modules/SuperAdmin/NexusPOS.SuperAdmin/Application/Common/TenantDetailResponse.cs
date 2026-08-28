namespace NexusPOS.SuperAdmin.Application.Common;

public sealed record TenantDetailResponse(
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
    List<TenantSubscriptionResponse> SubscriptionHistory,
    string BusinessType = "Retail",
    bool AiEnabled = false);
