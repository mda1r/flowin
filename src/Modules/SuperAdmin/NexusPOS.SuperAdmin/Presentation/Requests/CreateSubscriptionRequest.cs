namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record CreateSubscriptionRequest(
    Guid PlanId,
    DateTime StartDate,
    DateTime ExpiryDate,
    string? Notes);
