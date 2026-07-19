namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record CreateSubscriptionPlanRequest(
    string Name,
    string? BusinessType,
    decimal Price,
    int MaxBranches,
    int MaxUsers,
    List<string> Features);
