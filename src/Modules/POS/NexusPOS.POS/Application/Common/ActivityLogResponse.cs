namespace NexusPOS.POS.Application.Common;

public sealed record ActivityLogResponse(
    string Id,
    string Timestamp,
    string UserId,
    string UserName,
    string? UserEmail,
    string Category,
    string Action,
    string? Details,
    string? BranchId);
