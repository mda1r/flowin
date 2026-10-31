using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Queries.GetActivityLogs;

public sealed record GetActivityLogsQuery(
    Guid? BranchId,
    string? Category,
    DateTime? From,
    DateTime? To,
    int PageSize) : IQuery<IReadOnlyList<ActivityLogResponse>>;
