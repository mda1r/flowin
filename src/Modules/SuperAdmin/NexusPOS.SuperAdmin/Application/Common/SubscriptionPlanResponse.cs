namespace NexusPOS.SuperAdmin.Application.Common;

public sealed record SubscriptionPlanResponse(
    Guid Id,
    string Name,
    string? BusinessType,
    decimal Price,
    int MaxBranches,
    int MaxUsers,
    List<string> Features,
    bool IsActive,
    DateTime CreatedAt);
