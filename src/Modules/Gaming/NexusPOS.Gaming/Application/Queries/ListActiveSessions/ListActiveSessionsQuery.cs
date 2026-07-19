using NexusPOS.Gaming.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Queries.ListActiveSessions;

public sealed record ListActiveSessionsQuery(Guid BranchId) : IQuery<IReadOnlyList<GameSessionResponse>>;
