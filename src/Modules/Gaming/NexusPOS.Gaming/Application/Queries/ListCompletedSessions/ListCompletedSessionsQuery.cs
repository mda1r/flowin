using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Queries.ListCompletedSessions;

public sealed record CompletedSessionResponse(
    Guid Id,
    Guid StationId,
    string StationName,
    string PlayerName,
    DateTime StartTime,
    DateTime EndTime,
    int ActualMinutes,
    decimal TotalAmount,
    string? PaymentMethod,
    DateTime? PaidAt);

public sealed record ListCompletedSessionsQuery(Guid BranchId, DateTime From, DateTime To)
    : IQuery<IReadOnlyList<CompletedSessionResponse>>;
