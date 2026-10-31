namespace NexusPOS.CRM.Application.Common;

public sealed record LoyaltyTransactionResponse(
    Guid Id,
    int Delta,
    string Kind,
    Guid? OrderId,
    Guid? UserId,
    string? Reason,
    DateTime CreatedAt);
