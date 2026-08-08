namespace NexusPOS.POS.Presentation.Requests;

public sealed record LogActivityRequest(
    Guid? BranchId,
    string Category,
    string Action,
    string? Details,
    DateTime OccurredAt);
