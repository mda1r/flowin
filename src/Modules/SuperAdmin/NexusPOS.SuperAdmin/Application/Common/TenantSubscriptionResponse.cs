using NexusPOS.SuperAdmin.Domain.Enums;

namespace NexusPOS.SuperAdmin.Application.Common;

public sealed record TenantSubscriptionResponse(
    Guid Id,
    Guid TenantId,
    Guid PlanId,
    string PlanName,
    decimal PlanPrice,
    DateTime StartDate,
    DateTime ExpiryDate,
    SubscriptionStatus Status,
    int MaxBranches,
    int MaxUsers,
    string? Notes,
    DateTime CreatedAt,
    int DaysRemaining);
